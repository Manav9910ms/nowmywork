import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { assertTransition } from '@/lib/job-state';
import { requireUser, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireUser(request);
    const { jobId } = await params;
    const body = await request.json() as { status?: string };
    const target = body.status;
    if (!target) return NextResponse.json({ error: 'Status is required.' }, { status: 400 });

    const db = adminDb();
    const ref = db.collection('jobs').doc(jobId);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error('JOB_NOT_FOUND');
      const job = snapshot.data()!;
      const participant = job.clientId === user.uid || job.assignedToId === user.uid;
      if (!participant) throw new Error('FORBIDDEN');

      const current = String(job.status) as Parameters<typeof assertTransition>[0];
      assertTransition(current, target as Parameters<typeof assertTransition>[1]);

      if (target === 'IN_PROGRESS' && job.assignedToId !== user.uid) throw new Error('FORBIDDEN');
      if (target === 'SUBMITTED' && job.assignedToId !== user.uid) throw new Error('FORBIDDEN');
      if (target === 'COMPLETED' && job.clientId !== user.uid) throw new Error('FORBIDDEN');
      if (target === 'CANCELLED' && job.clientId !== user.uid && job.assignedToId !== user.uid) throw new Error('FORBIDDEN');

      transaction.update(ref, { status: target, updatedAt: FieldValue.serverTimestamp() });

      if (target === 'COMPLETED' || target === 'CANCELLED') {
        if (job.assignedToId) {
          const freelancerRef = db.collection('freelancers').doc(String(job.assignedToId));
          transaction.set(freelancerRef, { availability: 'AVAILABLE', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
        // No new offers can become valid after a terminal project state.
      }

      const recipient = user.uid === job.clientId ? job.assignedToId : job.clientId;
      if (recipient) {
        transaction.set(db.collection('notifications').doc(), {
          userId: recipient,
          type: 'PROJECT_STATUS',
          title: 'Project status updated',
          body: `${job.title} is now ${target.toLowerCase().replaceAll('_', ' ')}.`,
          jobId,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return { status: target };
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'JOB_NOT_FOUND') return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    if (message === 'INVALID_JOB_TRANSITION') return NextResponse.json({ error: 'That project status change is not allowed.' }, { status: 409 });
    const result = errorResponse(error);
    console.error('PATCH /api/projects/[jobId]/status', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
