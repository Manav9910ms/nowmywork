'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail, syncAccount } from '@/lib/auth';

type Mode = 'signin' | 'signup';
type Props = { mode: Mode };
type AuthError = { code?: string; message?: string };

function friendlyError(error: unknown) {
  const code = (error as AuthError)?.code ?? '';
  const message = (error as AuthError)?.message ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Choose a stronger password (at least 6 characters).',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Please allow popups and try again.',
    'auth/user-not-found': 'No account was found for this email.',
  };
  return messages[code] ?? message ?? 'Something went wrong. Please try again.';
}

export default function AuthCard({ mode }: Props) {
  const router = useRouter(); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState<'CLIENT' | 'FREELANCER'>('CLIENT'); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [forgot, setForgot] = useState(false);
  const signup = mode === 'signup';

  async function finishAuth(account: Awaited<ReturnType<typeof signUpWithEmail>>, selectedRole?: 'CLIENT' | 'FREELANCER') { await syncAccount(account, selectedRole); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      if (forgot) { await resetPassword(email); setMessage('Password reset instructions have been sent if that email is registered.'); return; }
      const account = signup ? await signUpWithEmail(email.trim(), password, name.trim()) : await signInWithEmail(email.trim(), password);
      await finishAuth(account, signup ? role : undefined); router.push('/dashboard'); router.refresh();
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function google() {
    setError(''); setMessage(''); setBusy(true);
    try { const account = await signInWithGoogle(); await finishAuth(account, signup ? role : undefined); router.push('/dashboard'); router.refresh(); }
    catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  return <div className="auth-card">
    <div><div className="eyebrow muted">{forgot ? 'RESET PASSWORD' : signup ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</div><h1>{forgot ? 'Reset your password.' : signup ? 'Start with NowMyWork.' : 'Good to see you.'}</h1><p>{forgot ? 'Enter your account email and we’ll send password reset instructions.' : signup ? 'Create your account and tell us which side of the marketplace you are on.' : 'Sign in to continue to your NowMyWork dashboard.'}</p></div>
    {signup && !forgot && <div className="role-switch" role="group" aria-label="Account type"><button type="button" className={role === 'CLIENT' ? 'selected' : ''} onClick={() => setRole('CLIENT')}>I need a freelancer</button><button type="button" className={role === 'FREELANCER' ? 'selected' : ''} onClick={() => setRole('FREELANCER')}>I want work</button></div>}
    <form onSubmit={submit} className="auth-form">
      {signup && !forgot && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required/></label>}
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required/></label>
      {!forgot && <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={6} required/></label>}
      {error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-success" role="status">{message}</div>}
      <button className="primary-btn auth-submit" disabled={busy}>{busy ? 'Please wait…' : forgot ? 'Send reset email →' : signup ? 'Create account →' : 'Sign in →'}</button>
    </form>
    {!forgot && <><div className="auth-or"><span/>or<span/></div><button className="google-btn" type="button" onClick={google} disabled={busy}><span className="google-mark">G</span>Continue with Google</button></>}
    <p className="auth-foot">{forgot ? <button type="button" className="auth-link-button" onClick={() => { setForgot(false); setError(''); setMessage(''); }}>Back to sign in</button> : signup ? <>Already have an account? <a href="/signin">Sign in</a></> : <>New to NowMyWork? <a href="/signup">Create an account</a><br/><button type="button" className="auth-link-button" onClick={() => { setForgot(true); setError(''); setMessage(''); }}>Forgot password?</button></>}</p>
  </div>;
}
