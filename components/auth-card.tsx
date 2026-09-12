'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '@/lib/auth';

type Mode = 'signin' | 'signup';

type Props = {
  mode: Mode;
};

function friendlyError(error: unknown) {
  const code = (error as { code?: string })?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Choose a stronger password (at least 6 characters).',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Please allow popups and try again.',
  };
  return messages[code] ?? 'Something went wrong. Please try again.';
}

export default function AuthCard({ mode }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'CLIENT' | 'FREELANCER'>('CLIENT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password, name.trim());
        window.localStorage.setItem('nowmywork_role', role);
      } else {
        await signInWithEmail(email.trim(), password);
      }
      router.push('/dashboard');
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
      window.localStorage.setItem('nowmywork_role', role);
      router.push('/dashboard');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === 'signup';

  return (
    <div className="auth-card">
      <div>
        <div className="eyebrow muted">{signup ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</div>
        <h1>{signup ? 'Start with NowMyWork.' : 'Good to see you.'}</h1>
        <p>{signup ? 'Create your account and tell us which side of the marketplace you are on.' : 'Sign in to continue to your NowMyWork dashboard.'}</p>
      </div>

      {signup && (
        <div className="role-switch" role="group" aria-label="Account type">
          <button type="button" className={role === 'CLIENT' ? 'selected' : ''} onClick={() => setRole('CLIENT')}>I need a freelancer</button>
          <button type="button" className={role === 'FREELANCER' ? 'selected' : ''} onClick={() => setRole('FREELANCER')}>I want work</button>
        </div>
      )}

      <form onSubmit={submit} className="auth-form">
        {signup && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required />
          </label>
        )}
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={6} required />
        </label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="primary-btn auth-submit" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account →' : 'Sign in →'}</button>
      </form>

      <div className="auth-or"><span />or<span /></div>
      <button className="google-btn" type="button" onClick={google} disabled={busy}>
        <span className="google-mark">G</span>
        Continue with Google
      </button>

      <p className="auth-foot">{signup ? 'Already have an account? ' : 'New to NowMyWork? '}<a href={signup ? '/signin' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</a></p>
    </div>
  );
}
