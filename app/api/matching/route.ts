import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { DEFAULT_MATCH_CANDIDATE_LIMIT, selectTopFreelancers, type FreelancerCandidate } from '@/lib/matching';
import { requireUser, assertRole, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

function candidateFromSnapshot(id: string, data: FirebaseFirestore.DocumentData): FreelancerCandidate {
  return {
    id,
    skills: Array.isArray(data.skills) ? data.skills.filter((v: unknown): v is string => typeof v === 'string') : [],
    techStack: Array.isArray(data.techStack) ? data.techStack.filter((v: unknown): v is string => typeof v === 'string') : [],
    rating: typeof data.rating === 'number' ? data.rating : 0,
    completedJobs: typeof data.completedJobs === 'number' ? data.completedJobs : 0,
    availability: data.availability === 'BUSY' || data.availability === 'AWAY' ? data.availability : 'AVAILABLE',
    hourlyRate: typeof data.hourlyRate === 'number' ? data.hourlyRate : null,
    experience: typeof data.experience === 'number' ? data.experience : 0,
    completionRate: typeof data.completionRate === 'number' ? data.completionRate : null,
    cancellationRate: typeof data.cancellationRate === 'number' ? data.cancellationRate : null,
    responseRate: typeof data.responseRate === 'number' ? data.responseRate : null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'CLIENT');
    const body = await request.json() as { jobId?: string; limit?: number };
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
    const candidates = freelancerSnapshot.docs.filter((doc) => doc.id !== user.uid).map((doc) => candidateFromSnapshot(doc.id, doc.data()));
    const configuredLimit = Number(process.env.MATCH_CANDIDATE_LIMIT ?? DEFAULT_MATCH_CANDIDATE_LIMIT);
    const requestedLimit = typeof body.limit === 'number' ? body.limit : configuredLimit;
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(20, Math.floor(requestedLimit))) : DEFAULT_MATCH_CANDIDATE_LIMIT;
    const matches = selectTopFreelancers({ skills: Array.isArray(job.skills) ? job.skills : [], techStack: Array.isArray(job.techStack) ? job.techStack : [], budget: Number(job.budget ?? 0), durationDays: Number(job.durationDays ?? 1), priority: job.priority }, candidates, limit);

    const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
    const now = Timestamp.now();
    await db.runTransaction(async (transaction) => {
      const latestJob = await transaction.get(jobRef);
      if (!latestJob.exists) throw new Error('PROJECT_NOT_OPEN');
      const latest = latestJob.data()!;
      if (latest.clientId !== user.uid || !['OPEN', 'MATCHING', 'OFFERED'].includes(String(latest.status))) throw new Error('PROJECT_NOT_OPEN');
      transaction.update(jobRef, { status: matches.length ? 'OFFERED' : 'OPEN', matchedAt: now, updatedAt: now, matchLimit: limit, matchCount: matches.length });

      for (const match of matches) {
        const offerId = `${jobId}_${match.id}`;
        const offerRef = db.collection('offers').doc(offerId);
        const existing = await transaction.get(offerRef);
        if (existing.exists && ['PENDING', 'ACCEPTED'].includes(String(existing.data()?.status))) continue;
        const nameDoc = freelancerSnapshot.docs.find((doc) => doc.id === match.id);
        transaction.set(offerRef, {
          jobId, clientId: user.uid, freelancerId: match.id,
          freelancerName: String(nameDoc?.data().displayName ?? 'Freelancer'),
          score: Math.round(match.score * 100) / 100, reasons: match.reasons,
          status: 'PENDING', expiresAt, createdAt: now, updatedAt: now,
          title: job.title, description: job.description, budget: Number(job.budget), currency: job.currency ?? 'INR',
          durationDays: Number(job.durationDays), skills: job.skills ?? [], techStack: job.techStack ?? [], priority: job.priority,
        });
        transaction.set(db.collection('notifications').doc(), {
          userId: match.id, type: 'JOB_OFFER', title: 'New project matched to you',
          body: `${job.title} · ${Math.round(match.score)}% match`, jobId, offerId,
          read: false, createdAt: now,
        });
      }
    });

    return NextResponse.json({ count: matches.length, matches });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROJECT_NOT_OPEN') return NextResponse.json({ error: 'This project became unavailable while matching was running.' }, { status: 409 });
    const result = errorResponse(error);
    console.error('POST /api/matching', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
