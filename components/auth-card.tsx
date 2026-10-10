'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetPassword, signInWithEmail, signInWithGoogle, signUpWithEmail, syncAccount, logOut, type AccountRole } from '@/lib/auth';
import { auth, db, firebaseApp } from '@/lib/firebase';

type Mode = 'signin' | 'signup';
type Props = { mode: Mode };
type AuthError = { code?: string };

function friendlyError(error: unknown) {
  const code = (error as AuthError)?.code ?? '';
  const messages: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Choose a stronger password (at least 6 characters).',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the sign-in popup. Please allow popups and try again.',
    'auth/user-not-found': 'No account was found for this email.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled for NowMyWork yet.',
  };
  return messages[code] ?? 'Something went wrong. Please try again.';
}

function roleLabel(role: AccountRole | null) {
  if (role === 'CLIENT') return 'client';
  if (role === 'FREELANCER') return 'freelancer';
  return null;
}

export default function AuthCard({ mode }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AccountRole>('CLIENT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [forgot, setForgot] = useState(false);
  const [authCheckDone, setAuthCheckDone] = useState(false);
  const [existingSession, setExistingSession] = useState(false);
  const [existingRole, setExistingRole] = useState<AccountRole | null>(null);
  const [roleLookupFailed, setRoleLookupFailed] = useState(false);
  const signup = mode === 'signup';

  useEffect(() => {
    if (!firebaseApp) {
      setAuthCheckDone(true);
      return;
    }

    // Only inspect the session restored when this page first opens. Later auth
    // changes can come from this form's own successful signup/sign-in operation.
    let initialStateHandled = false;
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (initialStateHandled) return;
        initialStateHandled = true;

        if (!currentUser) {
          setAuthCheckDone(true);
          return;
        }

        setExistingSession(true);
        try {
          const snapshot = await getDoc(doc(db, 'users', currentUser.uid));
          const savedRole = snapshot.data()?.role;
          if (savedRole === 'CLIENT' || savedRole === 'FREELANCER') {
            setExistingRole(savedRole);
          } else {
            setRoleLookupFailed(true);
          }
        } catch {
          setRoleLookupFailed(true);
        } finally {
          setAuthCheckDone(true);
        }
      },
      () => {
        // Do not expose signup role selection when the saved session cannot
        // be safely resolved.
        if (initialStateHandled) return;
        initialStateHandled = true;
        setExistingSession(true);
        setRoleLookupFailed(true);
        setAuthCheckDone(true);
      },
    );

    return unsubscribe;
  }, []);

  async function finishAuth(account: Awaited<ReturnType<typeof signUpWithEmail>>, selectedRole?: AccountRole) {
    await syncAccount(account, selectedRole);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (forgot) {
        await resetPassword(email);
        setMessage('If an account exists for that email, password reset instructions have been sent.');
        return;
      }
      const account = signup
        ? await signUpWithEmail(email.trim(), password, name.trim())
        : await signInWithEmail(email.trim(), password);
      await finishAuth(account, signup ? role : undefined);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const account = await signInWithGoogle();
      await finishAuth(account, signup ? role : undefined);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function signOutExistingAccount() {
    setBusy(true);
    setError('');
    try {
      await logOut();
      setExistingSession(false);
      setExistingRole(null);
      setRoleLookupFailed(false);
      setRole('CLIENT');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!authCheckDone) {
    return (
      <div className="auth-card" aria-busy="true">
        <div className="eyebrow muted">CHECKING ACCOUNT</div>
        <h1>One moment.</h1>
        <p>Checking whether you already have a NowMyWork account signed in.</p>
      </div>
    );
  }

  if (existingSession) {
    const savedRoleLabel = roleLabel(existingRole);
    return (
      <div className="auth-card">
        <div className="eyebrow muted">ACCOUNT ROLE LOCKED</div>
        <h1>{savedRoleLabel ? `You're signed in as a ${savedRoleLabel}.` : 'Your account is already signed in.'}</h1>
        <p>
          {savedRoleLabel
            ? `This account is registered as a ${savedRoleLabel} account. Its role cannot be changed to the other role.`
            : 'We could not verify this account’s saved role, so role selection is disabled to protect your account.'}
        </p>
        {savedRoleLabel && (
          <p className="auth-foot">
            To use NowMyWork as a {savedRoleLabel === 'client' ? 'freelancer' : 'client'}, sign out and create a separate account with a different email address.
          </p>
        )}
        {roleLookupFailed && (
          <div className="auth-error" role="alert">
            We could not verify your saved account role. Open your dashboard or sign out before using another account.
          </div>
        )}
        <Link className="primary-btn auth-submit" href="/dashboard">Go to dashboard →</Link>
        <button className="google-btn" type="button" onClick={signOutExistingAccount} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out to use another account'}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div>
        <div className="eyebrow muted">{forgot ? 'RESET PASSWORD' : signup ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</div>
        <h1>{forgot ? 'Reset your password.' : signup ? 'Start with NowMyWork.' : 'Good to see you.'}</h1>
        <p>
          {forgot
            ? 'Enter your account email and we’ll send password reset instructions.'
            : signup
              ? 'Choose one account type. Your role stays fixed for this account.'
              : 'Sign in to continue to your NowMyWork dashboard.'}
        </p>
      </div>

      {signup && !forgot && (
        <>
          <div className="role-switch" role="group" aria-label="Choose one account type">
            <button type="button" className={role === 'CLIENT' ? 'selected' : ''} onClick={() => setRole('CLIENT')}>
              I need a freelancer
            </button>
            <button type="button" className={role === 'FREELANCER' ? 'selected' : ''} onClick={() => setRole('FREELANCER')}>
              I want work
            </button>
          </div>
          <p className="auth-foot">A client account cannot be used as a freelancer account, and vice versa.</p>
        </>
      )}

      <form onSubmit={submit} className="auth-form">
        {signup && !forgot && (
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" autoComplete="name" maxLength={100} required />
          </label>
        )}
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" autoComplete="email" maxLength={254} required />
        </label>
        {!forgot && (
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={6} maxLength={128} required />
          </label>
        )}
        {error && <div className="auth-error" role="alert">{error}</div>}
        {message && <div className="auth-success" role="status">{message}</div>}
        <button className="primary-btn auth-submit" disabled={busy}>
          {busy ? 'Please wait…' : forgot ? 'Send reset email →' : signup ? 'Create account →' : 'Sign in →'}
        </button>
      </form>

      {!forgot && (
        <>
          <div className="auth-or"><span />or<span /></div>
          <button className="google-btn" type="button" onClick={google} disabled={busy}>
            <span className="google-mark">G</span>Continue with Google
          </button>
        </>
      )}

      <p className="auth-foot">
        {forgot ? (
          <button type="button" className="auth-link-button" onClick={() => { setForgot(false); setError(''); setMessage(''); }}>
            Back to sign in
          </button>
        ) : signup ? (
          <>Already have an account? <Link href="/signin">Sign in</Link></>
        ) : (
          <>
            New to NowMyWork? <Link href="/signup">Create an account</Link>
            <br />
            <button type="button" className="auth-link-button" onClick={() => { setForgot(true); setError(''); setMessage(''); }}>
              Forgot password?
            </button>
          </>
        )}
      </p>
    </div>
  );
}
