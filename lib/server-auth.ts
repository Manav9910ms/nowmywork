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

  const userData = userSnapshot.data()!;
  const role = userData.role;
  if (typeof role !== 'string' || !roles.has(role as AppRole)) throw new Error('ACCOUNT_NOT_READY');

  return {
    uid: token.uid,
    email: token.email ?? null,
    role: role as AppRole,
    freelancerApprovalStatus: typeof userData.freelancerApprovalStatus === 'string' ? userData.freelancerApprovalStatus : null,
    token,
  };
}

/**
 * Admin access requires a verified email, Google as the current Firebase sign-in
 * provider, and an explicit server-only allowlist. Firestore's user role field is
 * not sufficient to grant admin access. Set ADMIN_EMAILS in Vercel as a
 * comma-separated list of trusted admin emails.
 */
export async function requireAdminUser(request: NextRequest) {
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

  if (token.email_verified !== true) throw new Error('ADMIN_EMAIL_NOT_VERIFIED');
  if (token.firebase?.sign_in_provider !== 'google.com') throw new Error('ADMIN_GOOGLE_SIGN_IN_REQUIRED');
  const email = typeof token.email === 'string' ? token.email.trim().toLowerCase() : '';
  if (!email) throw new Error('ADMIN_EMAIL_NOT_VERIFIED');

  const allowedEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length === 0) throw new Error('ADMIN_ACCESS_NOT_CONFIGURED');
  if (!allowedEmails.includes(email)) throw new Error('ADMIN_EMAIL_NOT_ALLOWED');

  return { uid: token.uid, email, token };
}

export function assertRole(role: AppRole, ...allowed: AppRole[]) {
  if (!allowed.includes(role)) throw new Error('FORBIDDEN');
}

export async function assertFreelancerApproved(user: { uid: string; role: AppRole }) {
  assertRole(user.role, 'FREELANCER');
  // The approval request is writable only by the Admin SDK. Do not trust the
  // browser-readable users document as the authoritative approval record.
  const approval = await adminDb().collection('freelancerApprovalRequests').doc(user.uid).get();
  if (!approval.exists || approval.data()?.status !== 'APPROVED') {
    throw new Error('FREELANCER_NOT_APPROVED');
  }
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHENTICATED') return { status: 401, message: 'Sign in is required.' };
  if (message === 'ACCOUNT_NOT_READY') return { status: 401, message: 'Your NowMyWork account setup is incomplete. Please sign in again.' };
  if (message === 'FORBIDDEN') return { status: 403, message: 'You do not have permission for this action.' };
  if (message === 'FREELANCER_NOT_APPROVED') return { status: 403, message: 'Your freelancer application is awaiting approval. Complete your profile and wait for the review before accessing freelancer features.' };
  if (message === 'ADMIN_EMAIL_NOT_VERIFIED') return { status: 403, message: 'Verify this email address in Firebase Authentication before accessing the admin panel.' };
  if (message === 'ADMIN_GOOGLE_SIGN_IN_REQUIRED') return { status: 403, message: 'Admin access requires signing in with Google. Sign out and continue with the authorized Google account.' };
  if (message === 'ADMIN_EMAIL_NOT_ALLOWED') return { status: 403, message: 'This verified email is not authorized for the NowMyWork admin panel.' };
  if (message === 'ADMIN_ACCESS_NOT_CONFIGURED') return { status: 503, message: 'Admin access is not configured. Set the server-only ADMIN_EMAILS environment variable in Vercel.' };
  return { status: 500, message: 'Something went wrong. Please try again.' };
}
