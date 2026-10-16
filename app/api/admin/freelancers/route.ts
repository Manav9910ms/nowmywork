import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/admin';
import { requireAdminUser, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

type FreelancerDocument = Record<string, unknown> & { id: string };

function toMillis(value: unknown): number {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toIso(value: unknown): string | null {
  const millis = toMillis(value);
  return millis ? new Date(millis).toISOString() : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 30)
    : [];
}

function toPublicFreelancer(document: FreelancerDocument) {
  const data = document;
  return {
    id: document.id,
    name: asString(data.name, asString(data.displayName, 'Freelancer')),
    email: asString(data.email),
    roleTitle: asString(data.roleTitle, asString(data.title)),
    description: asString(data.description, asString(data.bio)),
    skills: asStringArray(data.skills ?? data.techStack),
    experience: typeof data.experience === 'number'
      ? data.experience
      : typeof data.experienceYears === 'number' ? data.experienceYears : 0,
    availability: asString(data.availability, 'UNKNOWN'),
    rating: typeof data.rating === 'number' ? data.rating : 0,
    applicationStatus: asString(data.applicationStatus, 'UNKNOWN'),
    profileUrl: asString(data.profileUrl, asString(data.portfolioUrl)),
    updatedAt: toIso(data.updatedAt) ?? toIso(data.submittedAt),
  };
}

function searchableText(freelancer: ReturnType<typeof toPublicFreelancer>) {
  return [
    freelancer.name,
    freelancer.email,
    freelancer.roleTitle,
    freelancer.description,
    ...freelancer.skills,
  ].join(' ').toLocaleLowerCase('en');
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminUser(request);

    const rawQuery = request.nextUrl.searchParams.get('q') ?? '';
    const query = rawQuery.trim().slice(0, 120).toLocaleLowerCase('en');
    if (query.length === 1) {
      return NextResponse.json({ error: 'Enter at least 2 characters to search.' }, { status: 400 });
    }

    const collection = adminDb().collection('freelancers');
    let documents: FreelancerDocument[];

    if (!query) {
      const snapshot = await collection.orderBy('updatedAt', 'desc').limit(20).get();
      documents = snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
    } else {
      // Firestore has no native substring search. Search on the server so the
      // browser never downloads the entire freelancer collection. Only the
      // 20 most recently updated matches are returned to the admin UI.
      const snapshot = await collection.get();
      documents = snapshot.docs
        .map((item): FreelancerDocument => ({ ...item.data(), id: item.id }))
        .map((document) => ({ document, publicProfile: toPublicFreelancer(document) }))
        .filter(({ publicProfile }) => searchableText(publicProfile).includes(query))
        .sort((a, b) => toMillis(b.document.updatedAt ?? b.document.submittedAt) - toMillis(a.document.updatedAt ?? a.document.submittedAt))
        .slice(0, 20)
        .map(({ document }) => document);
    }

    const freelancers = documents
      .map(toPublicFreelancer)
      .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));

    return NextResponse.json({
      freelancers,
      totalReturned: freelancers.length,
      limit: 20,
      search: query,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const result = errorResponse(error);
    console.error('GET /api/admin/freelancers', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
