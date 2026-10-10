import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Deliberately disabled while the matching engine is being redesigned.
// Keep the endpoint so old clients receive a clear response instead of falling back
// to an accidental or incomplete matching implementation.
export async function POST() {
  return NextResponse.json({
    error: 'Freelancer matching is temporarily paused while NowMyWork redesigns the matching engine. Your project is saved and remains available in your dashboard.',
    code: 'MATCHING_PAUSED',
  }, { status: 410 });
}
