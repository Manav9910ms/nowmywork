import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin';
import { requireAdminUser, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);
    const db = adminDb();
    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    const [clients, adminProfileSnapshots, freelancers, jobs, offers] = await Promise.all([
      db.collection('users').where('role', '==', 'CLIENT').get(),
      Promise.all(adminEmails.map((email) => db.collection('users').where('email', '==', email).get())),
      db.collection('freelancers').count().get(),
      db.collection('jobs').count().get(),
      db.collection('offers').count().get(),
    ]);

    // Older regular sign-ins may already have created a CLIENT document for an
    // admin email. Exclude those allowlisted identities from marketplace client
    // metrics without deleting any existing account data.
    const adminClientIds = new Set(
      adminProfileSnapshots.flatMap((snapshot) =>
        snapshot.docs
          .filter((document) => document.data().role === 'CLIENT')
          .map((document) => document.id),
      ),
    );
    const clientCount = clients.docs.filter((document) => !adminClientIds.has(document.id)).length;

    return NextResponse.json({
      counts: {
        users: clientCount,
        freelancers: freelancers.data().count,
        jobs: jobs.data().count,
        offers: offers.data().count,
      },
    });
  } catch (error) {
    const result = errorResponse(error);
    console.error('GET /api/admin/overview', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
