import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin';
import { requireUser, assertRole, errorResponse } from '@/lib/server-auth';
import { freelancerProfileSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'FREELANCER');
    const snapshot = await adminDb().collection('freelancers').doc(user.uid).get();
    return NextResponse.json({ profile: snapshot.exists ? snapshot.data() : null });
  } catch (error) {
    const result = errorResponse(error);
    console.error('GET /api/profile/freelancer', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'FREELANCER');
    const parsed = freelancerProfileSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid freelancer profile.', issues: parsed.error.flatten() }, { status: 400 });

    const db = adminDb();
    const ref = db.collection('freelancers').doc(user.uid);
    const existing = await ref.get();
    const previous = existing.data() ?? {};
    const profile = {
      userId: user.uid,
      displayName: String(previous.displayName ?? user.email?.split('@')[0] ?? 'Freelancer'),
      rating: typeof previous.rating === 'number' ? previous.rating : 0,
      completedJobs: typeof previous.completedJobs === 'number' ? previous.completedJobs : 0,
      completionRate: typeof previous.completionRate === 'number' ? previous.completionRate : null,
      cancellationRate: typeof previous.cancellationRate === 'number' ? previous.cancellationRate : null,
      responseRate: typeof previous.responseRate === 'number' ? previous.responseRate : null,
      ...parsed.data,
      updatedAt: new Date(),
    };
    await ref.set(profile, { merge: true });
    return NextResponse.json({ profile });
  } catch (error) {
    const result = errorResponse(error);
    console.error('PUT /api/profile/freelancer', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
