'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logOut, signInWithEmail, signInWithGoogle } from '@/lib/auth';

type AuthError = { code?: string };

function friendlyError(error: unknown) {
  const code = (error as AuthError)?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'No Firebase Authentication account was found for this email.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Please allow popups and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled for NowMyWork yet.',
  };
  return messages[code] ?? 'Sign-in failed. Please try again.';
}

export default function AdminAuthCard() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function continueToAdmin() {
    // Deliberately do NOT call syncAccount here. Admin authentication must not
    // create a client/freelancer Firestore profile as a side effect.
    router.replace('/admin');
    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      await continueToAdmin();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
      await continueToAdmin();
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
        <p>Use a verified Firebase account authorized for NowMyWork administration.</p>
        <p className="auth-foot">This sign-in does not create a client or freelancer profile. Access is checked separately by the server.</p>
      </div>

      <form onSubmit={submit} className="auth-form">
        <label>
          Admin email
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" type="email" autoComplete="username" maxLength={254} required />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" type="password" autoComplete="current-password" maxLength={128} required />
        </label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="primary-btn auth-submit" disabled={busy}>
          {busy ? 'Verifying…' : 'Continue to admin →'}
        </button>
      </form>

      <div className="auth-or"><span />or<span /></div>
      <button className="google-btn" type="button" onClick={google} disabled={busy}>
        <span className="google-mark">G</span>Continue with Google
      </button>

      <p className="auth-foot">
        Not the right account?{' '}
        <button type="button" className="auth-link-button" onClick={switchAccount} disabled={busy}>
          Sign out
        </button>
        {' '}then sign in with the authorized admin account.
      </p>
      <p className="auth-foot"><Link href="/">Back to homepage</Link></p>
    </div>
  );
}
