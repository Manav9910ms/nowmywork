import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { requireUser, assertRole, errorResponse } from '@/lib/server-auth';
import { createJobSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'CLIENT');
    const snapshot = await adminDb().collection('jobs').where('clientId', '==', user.uid).get();
    const jobs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort((a, b) => {
      const left = a.updatedAt?.toMillis?.() ?? 0;
      const right = b.updatedAt?.toMillis?.() ?? 0;
      return right - left;
    });
    return NextResponse.json({ jobs });
  } catch (error) {
    const result = errorResponse(error);
    console.error('GET /api/jobs', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'CLIENT');
    const parsed = createJobSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid project details.', issues: parsed.error.flatten() }, { status: 400 });

    const now = FieldValue.serverTimestamp();
    const reference = await adminDb().collection('jobs').add({
      ...parsed.data,
      clientId: user.uid,
      currency: 'INR',
      status: 'OPEN',
      assignedToId: null,
      matchingVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id: reference.id, message: 'Project posted.' }, { status: 201 });
  } catch (error) {
    const result = errorResponse(error);
    console.error('POST /api/jobs', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
