import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { requireUser, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

async function getParticipantJob(jobId: string, uid: string) {
  const job = await adminDb().collection('jobs').doc(jobId).get();
  if (!job.exists) throw new Error('JOB_NOT_FOUND');
  const data = job.data()!;
  if (data.clientId !== uid && data.assignedToId !== uid) throw new Error('FORBIDDEN');
  return data;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const jobId = new URL(request.url).searchParams.get('jobId')?.trim();
    if (!jobId) return NextResponse.json({ error: 'Project ID is required.' }, { status: 400 });
    await getParticipantJob(jobId, user.uid);
    const snapshot = await adminDb().collection('messages').where('jobId', '==', jobId).limit(200).get();
    const messages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
    return NextResponse.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'JOB_NOT_FOUND') return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const result = errorResponse(error);
    console.error('GET /api/messages', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json() as { jobId?: string; text?: string };
    const jobId = body.jobId?.trim();
    const text = body.text?.trim();
    if (!jobId || !text || text.length > 5000) return NextResponse.json({ error: 'Project ID and a message up to 5,000 characters are required.' }, { status: 400 });
    const job = await getParticipantJob(jobId, user.uid);
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(String(job.status))) return NextResponse.json({ error: 'Messaging is available once the project is assigned.' }, { status: 409 });

    const reference = await adminDb().collection('messages').add({ jobId, senderId: user.uid, senderRole: user.role, text, read: false, createdAt: FieldValue.serverTimestamp() });
    const recipientId = user.uid === job.clientId ? job.assignedToId : job.clientId;
    if (recipientId) await adminDb().collection('notifications').add({ userId: recipientId, type: 'NEW_MESSAGE', title: 'New project message', body: text.slice(0, 100), jobId, read: false, createdAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ id: reference.id, success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'JOB_NOT_FOUND') return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const result = errorResponse(error);
    console.error('POST /api/messages', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
