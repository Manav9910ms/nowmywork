import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/admin';

export type AppRole = 'CLIENT' | 'FREELANCER' | 'ADMIN';

export async function requireUser(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) throw new Error('UNAUTHENTICATED');
  const token = await adminAuth().verifyIdToken(header.slice(7));
  const userSnapshot = await adminDb().collection('users').doc(token.uid).get();
  const role = (userSnapshot.data()?.role as AppRole | undefined) ?? 'CLIENT';
  return { uid: token.uid, email: token.email ?? null, role, token };
}

export function assertRole(role: AppRole, ...allowed: AppRole[]) {
  if (!allowed.includes(role)) throw new Error('FORBIDDEN');
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHENTICATED' || message === 'auth/id-token-expired' || message === 'auth/argument-error') {
    return { status: 401, message: 'Sign in is required.' };
  }
  if (message === 'FORBIDDEN') return { status: 403, message: 'You do not have permission for this action.' };
  return { status: 500, message: 'Something went wrong. Please try again.' };
}
