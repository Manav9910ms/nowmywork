import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { DEFAULT_MATCH_CANDIDATE_LIMIT, selectTopFreelancers, type FreelancerCandidate } from '@/lib/matching';
import { requireUser, assertRole, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

function candidateFromSnapshot(id: string, data: FirebaseFirestore.DocumentData): FreelancerCandidate {
  const availability = data.availability === 'AVAILABLE' ? 'AVAILABLE' : data.availability === 'AWAY' ? 'AWAY' : 'BUSY';
  return {
    id,
    skills: Array.isArray(data.skills) ? data.skills.filter((value: unknown): value is string => typeof value === 'string') : [],
    techStack: Array.isArray(data.techStack) ? data.techStack.filter((value: unknown): value is string => typeof value === 'string') : [],
    rating: typeof data.rating === 'number' ? data.rating : 0,
    completedJobs: typeof data.completedJobs === 'number' ? data.completedJobs : 0,
    availability,
    hourlyRate: typeof data.hourlyRate === 'number' ? data.hourlyRate : null,
    experience: typeof data.experience === 'number' ? data.experience : 0,
    completionRate: typeof data.completionRate === 'number' ? data.completionRate : null,
    cancellationRate: typeof data.cancellationRate === 'number' ? data.cancellationRate : null,
    responseRate: typeof data.responseRate === 'number' ? data.responseRate : null,
  };
}

function configuredLimit() {
  const value = Number.parseInt(process.env.MATCH_CANDIDATE_LIMIT ?? '', 10);
  return Number.isFinite(value) ? Math.max(1, Math.min(50, value)) : DEFAULT_MATCH_CANDIDATE_LIMIT;
}

function offerPayload(jobId: string, clientId: string, title: string, description: string, budget: number, currency: string, durationDays: number, skills: string[], techStack: string[], priority: string, match: ReturnType<typeof selectTopFreelancers>[number], freelancerName: string, expiresAt: Timestamp, now: Timestamp) {
  return {
    jobId,
    clientId,
    freelancerId: match.id,
    freelancerName,
    score: Math.round(match.score * 100) / 100,
    reasons: match.reasons,
    status: 'PENDING',
    expiresAt,
    createdAt: now,
    updatedAt: now,
    title,
    description,
    budget,
    currency,
    durationDays,
    skills,
    techStack,
    priority,
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'CLIENT');
    const body = await request.json() as { jobId?: string };
    const jobId = body.jobId?.trim();
    if (!jobId) return NextResponse.json({ error: 'Project ID is required.' }, { status: 400 });

    const db = adminDb();
    const jobRef = db.collection('jobs').doc(jobId);
    const jobSnapshot = await jobRef.get();
    if (!jobSnapshot.exists) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const job = jobSnapshot.data()!;
    if (job.clientId !== user.uid) return NextResponse.json({ error: 'You do not own this project.' }, { status: 403 });
    if (!['OPEN', 'MATCHING', 'OFFERED'].includes(String(job.status))) return NextResponse.json({ error: 'This project is not available for matching.' }, { status: 409 });

    const freelancerSnapshot = await db.collection('freelancers').get();
    const candidates = freelancerSnapshot.docs
      .filter((doc) => doc.id !== user.uid)
      .map((doc) => candidateFromSnapshot(doc.id, doc.data()));
    const limit = configuredLimit();
    const matches = selectTopFreelancers({
      skills: Array.isArray(job.skills) ? job.skills : [],
      techStack: Array.isArray(job.techStack) ? job.techStack : [],
      budget: Number(job.budget ?? 0),
      durationDays: Number(job.durationDays ?? 1),
      priority: job.priority,
    }, candidates, limit);

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
    const selectedIds = new Set(matches.map((match) => match.id));

    await db.runTransaction(async (transaction) => {
      const latestJobSnapshot = await transaction.get(jobRef);
      const existingOfferQuery = db.collection('offers').where('jobId', '==', jobId);
      const existingOffersSnapshot = await transaction.get(existingOfferQuery);

      if (!latestJobSnapshot.exists) throw new Error('PROJECT_NOT_OPEN');
      const latest = latestJobSnapshot.data()!;
      if (latest.clientId !== user.uid || !['OPEN', 'MATCHING', 'OFFERED'].includes(String(latest.status))) throw new Error('PROJECT_NOT_OPEN');

      const existingByFreelancer = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
      for (const offer of existingOffersSnapshot.docs) {
        const freelancerId = String(offer.data().freelancerId ?? '');
        if (freelancerId) existingByFreelancer.set(freelancerId, offer);
      }

      for (const existing of existingOffersSnapshot.docs) {
        const data = existing.data();
        if (data.status === 'PENDING' && !selectedIds.has(String(data.freelancerId ?? ''))) {
          transaction.update(existing.ref, { status: 'SUPERSEDED', updatedAt: now });
        }
        if (data.status === 'ACCEPTED' && !latest.assignedToId) throw new Error('PROJECT_NOT_OPEN');
      }

      for (const match of matches) {
        const existing = existingByFreelancer.get(match.id);
        const freelancerDoc = freelancerSnapshot.docs.find((doc) => doc.id === match.id);
        const freelancerName = String(freelancerDoc?.data().displayName ?? 'Freelancer');
        const expiresMillis = existing?.data().expiresAt?.toMillis?.() ?? 0;

        if (existing?.data().status === 'PENDING' && expiresMillis > Date.now()) continue;
        transaction.set(existing?.ref ?? db.collection('offers').doc(`${jobId}_${match.id}`), offerPayload(
          jobId,
          user.uid,
          String(job.title),
          String(job.description),
          Number(job.budget),
          String(job.currency ?? 'INR'),
          Number(job.durationDays),
          Array.isArray(job.skills) ? job.skills : [],
          Array.isArray(job.techStack) ? job.techStack : [],
          String(job.priority),
          match,
          freelancerName,
          expiresAt,
          now,
        ));
        transaction.set(db.collection('notifications').doc(), {
          userId: match.id,
          type: 'JOB_OFFER',
          title: 'New project matched to you',
          body: `${job.title} · ${Math.round(match.score)}% match`,
          jobId,
          offerId: `${jobId}_${match.id}`,
          read: false,
          createdAt: now,
        });
      }

      transaction.update(jobRef, {
        status: matches.length ? 'OFFERED' : 'OPEN',
        matchedAt: now,
        updatedAt: now,
        matchLimit: limit,
        matchCount: matches.length,
      });
    });

    return NextResponse.json({ count: matches.length, matches });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_OPEN') return NextResponse.json({ error: 'This project became unavailable while matching was running.' }, { status: 409 });
    const result = errorResponse(error);
    console.error('POST /api/matching', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
