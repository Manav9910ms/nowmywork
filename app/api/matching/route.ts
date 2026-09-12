import { NextResponse } from 'next/server';
import { selectTopFreelancers, type FreelancerCandidate, type JobForMatching } from '@/lib/matching';

export const runtime = 'nodejs';

type RequestBody = JobForMatching & { freelancers: FreelancerCandidate[] };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    if (!Array.isArray(body.freelancers)) {
      return NextResponse.json({ error: 'freelancers must be an array' }, { status: 400 });
    }

    if (!body.title && (!Array.isArray(body.skills) || !Array.isArray(body.techStack))) {
      return NextResponse.json({ error: 'Invalid matching payload' }, { status: 400 });
    }

    const matches = selectTopFreelancers(body, body.freelancers, 10);
    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
