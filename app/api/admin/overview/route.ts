import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin';
import { requireAdminUser, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdminUser(request);
    const db = adminDb();
    const [users, freelancers, jobs, offers] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('freelancers').count().get(),
      db.collection('jobs').count().get(),
      db.collection('offers').count().get(),
    ]);
    return NextResponse.json({ counts: { users: users.data().count, freelancers: freelancers.data().count, jobs: jobs.data().count, offers: offers.data().count } });
  } catch (error) {
    const result = errorResponse(error);
    console.error('GET /api/admin/overview', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
