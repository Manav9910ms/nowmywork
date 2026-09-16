import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { requireUser, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const snapshot = await adminDb().collection('notifications').where('userId', '==', user.uid).limit(50).get();
    const notifications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    return NextResponse.json({ notifications });
  } catch (error) {
    const result = errorResponse(error);
    console.error('GET /api/notifications', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json() as { id?: string; all?: boolean };
    const db = adminDb();
    if (body.all) {
      const pending = await db.collection('notifications').where('userId', '==', user.uid).where('read', '==', false).get();
      const batch = db.batch();
      pending.docs.forEach((doc) => batch.update(doc.ref, { read: true, readAt: FieldValue.serverTimestamp() }));
      await batch.commit();
      return NextResponse.json({ success: true, count: pending.size });
    }
    if (!body.id) return NextResponse.json({ error: 'Notification ID is required.' }, { status: 400 });
    const ref = db.collection('notifications').doc(body.id);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.userId !== user.uid) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    await ref.update({ read: true, readAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ success: true });
  } catch (error) {
    const result = errorResponse(error);
    console.error('PATCH /api/notifications', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
