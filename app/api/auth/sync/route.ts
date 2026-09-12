import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { adminAuth } from '@/lib/firebase-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type Body = {
  idToken?: string;
  role?: 'CLIENT' | 'FREELANCER';
};

function getBearerToken(request: Request, body: Body) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  return body.idToken;
}

function safeError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `Database error ${error.code}.`;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'Database connection failed.';
  }

  if (error instanceof Error) {
    if (error.message === 'FIREBASE_ADMIN_CONFIG_MISSING') {
      return 'Firebase Admin configuration is missing.';
    }
    if (error.message.includes('private key')) {
      return 'Firebase Admin private key is invalid.';
    }
    if (error.message.includes('credential')) {
      return 'Firebase Admin credentials are invalid.';
    }
  }

  return 'Unable to sync account.';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const token = getBearerToken(request, body);
    if (!token) return NextResponse.json({ error: 'Missing Firebase ID token.' }, { status: 401 });

    const decoded = await adminAuth().verifyIdToken(token);
    const role = body.role === 'FREELANCER' ? 'FREELANCER' : body.role === 'CLIENT' ? 'CLIENT' : undefined;
    const email = decoded.email?.trim().toLowerCase();

    if (!email) return NextResponse.json({ error: 'Firebase account has no email.' }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            email,
            name: decoded.name?.trim() || existing.name || email.split('@')[0],
            ...(role && !existing.role ? { role } : {}),
          },
        })
      : await prisma.user.create({
          data: {
            firebaseUid: decoded.uid,
            email,
            name: decoded.name?.trim() || email.split('@')[0],
            role: role ?? 'CLIENT',
            ...(role === 'FREELANCER' ? { freelancer: { create: { skills: [], techStack: [] } } } : {}),
          },
        });

    if (user.role === 'FREELANCER') {
      await prisma.freelancer.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id, skills: [], techStack: [] },
      });
    }

    return NextResponse.json({
      user: { id: user.id, firebaseUid: user.firebaseUid, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Auth sync failed:', error);
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
