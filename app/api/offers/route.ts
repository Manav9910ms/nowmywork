import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { requireUser, assertRole, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request); assertRole(user.role, 'FREELANCER');
    const snapshot = await adminDb().collection('offers').where('freelancerId', '==', user.uid).get();
    const offers = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return NextResponse.json({ offers });
  } catch (error) { const result = errorResponse(error); console.error('GET /api/offers', error); return NextResponse.json({ error: result.message }, { status: result.status }); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request); assertRole(user.role, 'FREELANCER');
    const body = await request.json() as { offerId?: string; action?: 'ACCEPTED' | 'DECLINED' };
    const offerId = body.offerId?.trim();
    if (!offerId || !['ACCEPTED', 'DECLINED'].includes(body.action ?? '')) return NextResponse.json({ error: 'Offer ID and action are required.' }, { status: 400 });

    const db = adminDb(); const offerRef = db.collection('offers').doc(offerId); const now = FieldValue.serverTimestamp();
    if (body.action === 'DECLINED') {
      await db.runTransaction(async (transaction) => {
        const offer = await transaction.get(offerRef);
        if (!offer.exists || offer.data()?.freelancerId !== user.uid) throw new Error('NOT_FOUND');
        if (offer.data()?.status !== 'PENDING') throw new Error('OFFER_UNAVAILABLE');
        transaction.update(offerRef, { status: 'DECLINED', respondedAt: now, updatedAt: now });
      });
      return NextResponse.json({ success: true, status: 'DECLINED' });
    }

    const result = await db.runTransaction(async (transaction) => {
      const offer = await transaction.get(offerRef);
      if (!offer.exists || offer.data()?.freelancerId !== user.uid) throw new Error('NOT_FOUND');
      const offerData = offer.data()!; const jobRef = db.collection('jobs').doc(String(offerData.jobId)); const job = await transaction.get(jobRef);
      if (!job.exists) throw new Error('JOB_NOT_FOUND');
      const jobData = job.data()!;
      if (offerData.status !== 'PENDING') throw new Error('OFFER_UNAVAILABLE');
      if (offerData.expiresAt?.toMillis && offerData.expiresAt.toMillis() <= Date.now()) throw new Error('OFFER_EXPIRED');
      if (!['OPEN', 'OFFERED'].includes(String(jobData.status)) || jobData.assignedToId) throw new Error('JOB_ASSIGNED');

      transaction.update(jobRef, { status: 'ASSIGNED', assignedToId: user.uid, assignedAt: now, updatedAt: now });
      transaction.update(offerRef, { status: 'ACCEPTED', respondedAt: now, updatedAt: now });
      transaction.set(db.collection('notifications').doc(), { userId: jobData.clientId, type: 'PROJECT_ASSIGNED', title: 'Your project has been accepted', body: `${jobData.title} is now assigned to a freelancer.`, jobId: jobRef.id, read: false, createdAt: now });
      transaction.set(db.collection('notifications').doc(), { userId: user.uid, type: 'PROJECT_ASSIGNED', title: 'Project assigned to you', body: `You accepted ${jobData.title}.`, jobId: jobRef.id, read: false, createdAt: now });
      return { jobId: jobRef.id };
    });

    const pending = await db.collection('offers').where('jobId', '==', result.jobId).where('status', '==', 'PENDING').get();
    if (!pending.empty) {
      const batch = db.batch(); pending.docs.forEach((other) => batch.update(other.ref, { status: 'SUPERSEDED', updatedAt: now })); await batch.commit();
    }
    return NextResponse.json({ success: true, status: 'ACCEPTED', ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NOT_FOUND') return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
    if (message === 'OFFER_UNAVAILABLE') return NextResponse.json({ error: 'This offer is no longer available.' }, { status: 409 });
    if (message === 'OFFER_EXPIRED') return NextResponse.json({ error: 'This offer has expired.' }, { status: 409 });
    if (message === 'JOB_ASSIGNED') return NextResponse.json({ error: 'Another freelancer already accepted this project.' }, { status: 409 });
    if (message === 'JOB_NOT_FOUND') return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const result = errorResponse(error); console.error('POST /api/offers', error); return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
