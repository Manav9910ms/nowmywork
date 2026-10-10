import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { requireUser, assertRole, errorResponse } from '@/lib/server-auth';
import { freelancerApplicationSchema } from '@/lib/validation';

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
    assertRole(user.role, 'FREELANCER');
    const db = adminDb();
    const [userSnapshot, profileSnapshot, approvalSnapshot] = await Promise.all([
      db.collection('users').doc(user.uid).get(),
      db.collection('freelancers').doc(user.uid).get(),
      db.collection('freelancerApprovalRequests').doc(user.uid).get(),
    ]);
    const userData = userSnapshot.data() ?? {};
    const profile = profileSnapshot.data() ?? {};
    const approval = approvalSnapshot.data() ?? {};
    const status = String(userData.freelancerApprovalStatus ?? approval.status ?? 'NOT_SUBMITTED');
    return NextResponse.json({
      status,
      reviewNote: typeof approval.reviewNote === 'string' ? approval.reviewNote : '',
      application: profileSnapshot.exists ? {
        name: String(profile.name ?? profile.displayName ?? userData.name ?? ''),
        email: String(profile.email ?? user.email ?? ''),
        mobileNumber: String(profile.mobileNumber ?? ''),
        dateOfBirth: String(profile.dateOfBirth ?? ''),
        profileUrl: String(profile.profileUrl ?? profile.portfolioUrl ?? ''),
        description: String(profile.description ?? profile.bio ?? ''),
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        roleTitle: String(profile.roleTitle ?? ''),
        projectLinks: Array.isArray(profile.projectLinks) ? profile.projectLinks : [],
        experience: typeof profile.experience === 'number' ? profile.experience : 0,
        submittedAt: toIso(profile.submittedAt),
      } : null,
    });
  } catch (error) {
    const result = errorResponse(error);
    console.error('GET /api/profile/freelancer/application', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'FREELANCER');
    const parsed = freelancerApplicationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check your application details.', issues: parsed.error.flatten() }, { status: 400 });
    }
    if (!user.email || parsed.data.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Use the email address attached to your signed-in NowMyWork account.' }, { status: 400 });
    }

    const db = adminDb();
    const userRef = db.collection('users').doc(user.uid);
    const profileRef = db.collection('freelancers').doc(user.uid);
    const requestRef = db.collection('freelancerApprovalRequests').doc(user.uid);
    const now = FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
      const [userSnapshot, profileSnapshot, approvalSnapshot] = await Promise.all([
        transaction.get(userRef),
        transaction.get(profileRef),
        transaction.get(requestRef),
      ]);
      if (!userSnapshot.exists || userSnapshot.data()?.role !== 'FREELANCER') throw new Error('FORBIDDEN');

      const userData = userSnapshot.data() ?? {};
      const approval = approvalSnapshot.data() ?? {};
      const currentStatus = String(userData.freelancerApprovalStatus ?? approval.status ?? 'NOT_SUBMITTED');
      if (currentStatus === 'APPROVED') throw new Error('FREELANCER_ALREADY_APPROVED');

      const data = parsed.data;
      const previousProfile = profileSnapshot.data() ?? {};
      const submittedAt = approval.status === 'PENDING' && approval.submittedAt
        ? approval.submittedAt
        : now;

      transaction.set(profileRef, {
        userId: user.uid,
        name: data.name,
        displayName: data.name,
        email: data.email.toLowerCase(),
        mobileNumber: data.mobileNumber,
        dateOfBirth: data.dateOfBirth,
        profileUrl: data.profileUrl ?? '',
        portfolioUrl: data.profileUrl ?? '',
        description: data.description,
        bio: data.description,
        roleTitle: data.roleTitle,
        skills: data.skills,
        techStack: data.skills,
        projectLinks: data.projectLinks,
        experience: data.experience,
        experienceYears: data.experience,
        hourlyRate: typeof previousProfile.hourlyRate === 'number' ? previousProfile.hourlyRate : null,
        availability: typeof previousProfile.availability === 'string' ? previousProfile.availability : 'AVAILABLE',
        rating: typeof previousProfile.rating === 'number' ? previousProfile.rating : 0,
        completedJobs: typeof previousProfile.completedJobs === 'number' ? previousProfile.completedJobs : 0,
        applicationStatus: 'PENDING',
        submittedAt,
        updatedAt: now,
      }, { merge: true });

      transaction.set(userRef, {
        name: data.name,
        freelancerApprovalStatus: 'PENDING',
        updatedAt: now,
      }, { merge: true });

      transaction.set(requestRef, {
        freelancerId: user.uid,
        name: data.name,
        email: data.email.toLowerCase(),
        roleTitle: data.roleTitle,
        status: 'PENDING',
        reviewNote: '',
        videoStatus: 'AWAITING_EMAIL',
        submittedAt,
        updatedAt: now,
      }, { merge: true });
    });

    return NextResponse.json({
      success: true,
      status: 'PENDING',
      message: 'Your application has been sent to the admin review queue.',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'FREELANCER_ALREADY_APPROVED') {
      return NextResponse.json({ error: 'This freelancer account is already approved.' }, { status: 409 });
    }
    const result = errorResponse(error);
    console.error('POST /api/profile/freelancer/application', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
