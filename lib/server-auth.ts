import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/admin';

export type AppRole = 'CLIENT' | 'FREELANCER' | 'ADMIN';
const roles = new Set<AppRole>(['CLIENT', 'FREELANCER', 'ADMIN']);

export async function requireUser(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) throw new Error('UNAUTHENTICATED');

  const rawToken = header.slice(7).trim();
  if (!rawToken) throw new Error('UNAUTHENTICATED');

  let token;
  try {
    token = await adminAuth().verifyIdToken(rawToken);
  } catch {
    throw new Error('UNAUTHENTICATED');
  }

  const userSnapshot = await adminDb().collection('users').doc(token.uid).get();
  if (!userSnapshot.exists) throw new Error('ACCOUNT_NOT_READY');

  const role = userSnapshot.data()?.role;
  if (typeof role !== 'string' || !roles.has(role as AppRole)) throw new Error('ACCOUNT_NOT_READY');

  return { uid: token.uid, email: token.email ?? null, role: role as AppRole, token };
}

export function assertRole(role: AppRole, ...allowed: AppRole[]) {
  if (!allowed.includes(role)) throw new Error('FORBIDDEN');
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHENTICATED') return { status: 401, message: 'Sign in is required.' };
  if (message === 'ACCOUNT_NOT_READY') return { status: 401, message: 'Your NowMyWork account setup is incomplete. Please sign in again.' };
  if (message === 'FORBIDDEN') return { status: 403, message: 'You do not have permission for this action.' };
  return { status: 500, message: 'Something went wrong. Please try again.' };
}
