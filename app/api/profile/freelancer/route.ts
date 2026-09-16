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

    const existing = await adminDb().collection('freelancers').doc(user.uid).get();
    const profile = {
      userId: user.uid,
      displayName: existing.data()?.displayName ?? user.email?.split('@')[0] ?? 'Freelancer',
      rating: typeof existing.data()?.rating === 'number' ? existing.data()?.rating : 0,
      completedJobs: typeof existing.data()?.completedJobs === 'number' ? existing.data()?.completedJobs : 0,
      completionRate: typeof existing.data()?.completionRate === 'number' ? existing.data()?.completionRate : 100,
      cancellationRate: typeof existing.data()?.cancellationRate === 'number' ? existing.data()?.cancellationRate : 0,
      responseRate: typeof existing.data()?.responseRate === 'number' ? existing.data()?.responseRate : 50,
      ...parsed.data,
      updatedAt: new Date(),
    };
    await adminDb().collection('freelancers').doc(user.uid).set(profile, { merge: true });
    return NextResponse.json({ profile });
  } catch (error) {
    const result = errorResponse(error);
    console.error('PUT /api/profile/freelancer', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
