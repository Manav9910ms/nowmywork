import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { requireUser, assertRole, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

function toIso(value: unknown) {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  return typeof value === 'string' ? value : null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'ADMIN');
    const db = adminDb();
    const snapshot = await db.collection('freelancerApprovalRequests').where('status', '==', 'PENDING').limit(100).get();
    const requests = await Promise.all(snapshot.docs.map(async (item) => {
      const data = item.data();
      const profileSnapshot = await db.collection('freelancers').doc(item.id).get();
      const profile = profileSnapshot.data() ?? {};
      return {
        freelancerId: item.id,
        name: String(data.name ?? profile.name ?? 'Freelancer'),
        email: String(data.email ?? profile.email ?? ''),
        roleTitle: String(data.roleTitle ?? profile.roleTitle ?? ''),
        status: String(data.status ?? 'PENDING'),
        videoStatus: String(data.videoStatus ?? 'AWAITING_EMAIL'),
        submittedAt: toIso(data.submittedAt),
        mobileNumber: String(profile.mobileNumber ?? ''),
        dateOfBirth: String(profile.dateOfBirth ?? ''),
        profileUrl: String(profile.profileUrl ?? ''),
        description: String(profile.description ?? ''),
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        projectLinks: Array.isArray(profile.projectLinks) ? profile.projectLinks : [],
        experience: typeof profile.experience === 'number' ? profile.experience : 0,
      };
    }));
    requests.sort((a, b) => (a.submittedAt ? Date.parse(a.submittedAt) : 0) - (b.submittedAt ? Date.parse(b.submittedAt) : 0));
    return NextResponse.json({ requests });
  } catch (error) {
    const result = errorResponse(error);
    console.error('GET /api/admin/freelancer-approvals', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'ADMIN');
    const body = await request.json() as { freelancerId?: string; action?: string; note?: string };
    const freelancerId = body.freelancerId?.trim();
    if (!freelancerId || !['APPROVE', 'REJECT'].includes(body.action ?? '')) {
      return NextResponse.json({ error: 'Freelancer ID and a valid review action are required.' }, { status: 400 });
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
    const db = adminDb();
    const approvalRef = db.collection('freelancerApprovalRequests').doc(freelancerId);
    const userRef = db.collection('users').doc(freelancerId);
    const profileRef = db.collection('freelancers').doc(freelancerId);
    const now = FieldValue.serverTimestamp();
    const status = body.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await db.runTransaction(async (transaction) => {
      const [approvalSnapshot, userSnapshot, profileSnapshot] = await Promise.all([
        transaction.get(approvalRef),
        transaction.get(userRef),
        transaction.get(profileRef),
      ]);
      if (!approvalSnapshot.exists || approvalSnapshot.data()?.status !== 'PENDING') throw new Error('APPROVAL_NOT_PENDING');
      if (!userSnapshot.exists || userSnapshot.data()?.role !== 'FREELANCER') throw new Error('FREELANCER_NOT_FOUND');
      transaction.set(approvalRef, {
        status,
        reviewNote: note,
        reviewedAt: now,
        reviewedBy: user.uid,
        updatedAt: now,
      }, { merge: true });
      transaction.set(userRef, { freelancerApprovalStatus: status, updatedAt: now }, { merge: true });
      if (profileSnapshot.exists) transaction.set(profileRef, { applicationStatus: status, updatedAt: now }, { merge: true });
    });

    return NextResponse.json({ success: true, status, freelancerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'APPROVAL_NOT_PENDING') return NextResponse.json({ error: 'This application is no longer pending review.' }, { status: 409 });
    if (message === 'FREELANCER_NOT_FOUND') return NextResponse.json({ error: 'Freelancer account not found.' }, { status: 404 });
    const result = errorResponse(error);
    console.error('PATCH /api/admin/freelancer-approvals', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
