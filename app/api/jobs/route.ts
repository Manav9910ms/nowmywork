import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const priorities = new Set(['QUALITY', 'BALANCED', 'SPEED_BUDGET']);

type CreateJobInput = {
  clientId: string;
  title: string;
  description: string;
  budget: number;
  durationDays: number;
  skills: string[];
  techStack: string[];
  priority?: 'QUALITY' | 'BALANCED' | 'SPEED_BUDGET';
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateJobInput;

    if (!body.clientId || !body.title || !body.description) {
      return NextResponse.json({ error: 'clientId, title and description are required' }, { status: 400 });
    }

    if (!Number.isFinite(body.budget) || body.budget <= 0 || !Number.isInteger(body.durationDays) || body.durationDays <= 0) {
      return NextResponse.json({ error: 'budget and durationDays must be positive' }, { status: 400 });
    }

    if (!Array.isArray(body.skills) || !Array.isArray(body.techStack)) {
      return NextResponse.json({ error: 'skills and techStack must be arrays' }, { status: 400 });
    }

    const priority = body.priority ?? 'BALANCED';
    if (!priorities.has(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }

    const job = await prisma.job.create({
      data: {
        clientId: body.clientId,
        title: body.title.trim(),
        description: body.description.trim(),
        budget: Math.round(body.budget),
        durationDays: body.durationDays,
        skills: body.skills.map((value) => value.trim()).filter(Boolean),
        techStack: body.techStack.map((value) => value.trim()).filter(Boolean),
        priority,
        status: 'OPEN',
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unable to create job' }, { status: 500 });
  }
}
