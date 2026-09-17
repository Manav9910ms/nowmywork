import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin';
import { clientFeePercent, freelancerFeePercent } from '@/lib/fees';
import { requireUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const jobId = new URL(request.url).searchParams.get('jobId')?.trim();
    if (!jobId) return NextResponse.json({ error: 'Project ID is required.' }, { status: 400 });

    const db = adminDb();
    const jobSnapshot = await db.collection('jobs').doc(jobId).get();
    if (!jobSnapshot.exists) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const job = jobSnapshot.data()!;
    const participant = job.clientId === user.uid || job.assignedToId === user.uid;
    if (!participant) return NextResponse.json({ error: 'You do not have access to this project.' }, { status: 403 });

    const sessionSnapshot = await db.collection('paymentSessions').doc(jobId).get();
    const session = sessionSnapshot.exists ? sessionSnapshot.data() : null;
    return NextResponse.json({
      exists: sessionSnapshot.exists,
      session: session ? {
        finalAmount: Number(session.finalAmount ?? job.budget ?? 0),
        clientFee: Number(session.clientFee ?? 0),
        freelancerFee: Number(session.freelancerFee ?? 0),
        clientFeePercent: Number(session.clientFeePercent ?? clientFeePercent()),
        freelancerFeePercent: Number(session.freelancerFeePercent ?? freelancerFeePercent()),
        clientPaymentStatus: session.clientPaymentStatus ?? 'PENDING',
        freelancerPaymentStatus: session.freelancerPaymentStatus ?? 'PAYOUT_PENDING',
        contactsUnlocked: Boolean(session.contactsUnlocked),
      } : null,
      clientFeePercent: clientFeePercent(),
      freelancerFeePercent: freelancerFeePercent(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHENTICATED' || message === 'ACCOUNT_NOT_READY' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? 'Sign in is required.' : status === 403 ? 'You do not have access to this project.' : 'Could not load payment status.' }, { status });
  }
}
