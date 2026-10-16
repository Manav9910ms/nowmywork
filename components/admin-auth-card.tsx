'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logOut, signInWithGoogle } from '@/lib/auth';

type AuthError = { code?: string };

function friendlyError(error: unknown) {
  const code = (error as AuthError)?.code ?? '';
  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Please allow popups and try again.',
    'auth/account-exists-with-different-credential': 'This email is registered with another sign-in method. Ask the administrator to link Google sign-in to this Firebase account first.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'Google sign-in is not enabled for NowMyWork yet.',
    'auth/unauthorized-domain': 'This domain is not authorized for Firebase Google sign-in.',
    'auth/user-disabled': 'This Firebase account has been disabled.',
  };
  return messages[code] ?? 'Google sign-in failed. Please try again.';
}

export default function AdminAuthCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function google() {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
      // Do not call syncAccount: admin sign-in must not create a
      // client/freelancer profile as a side effect.
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function switchAccount() {
    setBusy(true);
    setError('');
    try {
      await logOut();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <div>
        <div className="eyebrow muted">ADMIN ACCESS ONLY</div>
        <h1>Sign in to the control room.</h1>
        <p>Continue with Google using a verified email explicitly authorized for NowMyWork administration.</p>
        <p className="auth-foot">Google sign-in only. This flow does not create a client or freelancer profile. The server independently checks the Google sign-in, verified email, and admin allowlist.</p>
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="google-btn" type="button" onClick={google} disabled={busy}>
        <span className="google-mark">G</span>{busy ? 'Verifying Google account…' : 'Continue with Google'}
      </button>

      <p className="auth-foot">
        Not the right account?{' '}
        <button type="button" className="auth-link-button" onClick={switchAccount} disabled={busy}>
          Sign out
        </button>
        {' '}then continue with the authorized Google account.
      </p>
      <p className="auth-foot"><Link href="/">Back to homepage</Link></p>
    </div>
  );
}
