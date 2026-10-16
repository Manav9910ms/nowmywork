'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import AdminFreelancerApprovals from '@/components/admin-freelancer-approvals';
import styles from './admin.module.css';

type Counts = { users: number; freelancers: number; jobs: number; offers: number };
type AdminResponse = { counts?: Counts; error?: string };

async function responseJson(response: Response): Promise<AdminResponse> {
  const body = await response.text();
  if (!body.trim()) throw new Error('The server returned an empty response. Please try again.');
  try { return JSON.parse(body) as AdminResponse; }
  catch { throw new Error('The server returned an invalid response. Please try again.'); }
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [state, setState] = useState<'checking' | 'signed-out' | 'denied' | 'authorized'>('checking');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    let requestVersion = 0;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const version = ++requestVersion;
      if (!active) return;
      setUser(currentUser);
      setCounts(null);
      setMessage('');

      if (!currentUser) {
        setState('signed-out');
        return;
      }

      setState('checking');
      void (async () => {
        try {
          // Refresh the Firebase token so the server sees the current email_verified claim.
          const token = await currentUser.getIdToken(true);
          const response = await fetch('/api/admin/overview', {
            headers: { authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          const data = await responseJson(response);
          if (!active || version !== requestVersion) return;
          if (!response.ok) {
            setMessage(data.error ?? 'This verified Firebase email is not authorized for the admin panel.');
            setState('denied');
            return;
          }
          setCounts(data.counts ?? null);
          setState('authorized');
        } catch (error) {
          if (!active || version !== requestVersion) return;
          setMessage(error instanceof Error ? error.message : 'Could not verify admin access.');
          setState('denied');
        }
      })();
    });

    return () => {
      active = false;
      requestVersion += 1;
      unsubscribe();
    };
  }, []);

  async function signOut() {
    await logOut();
    setUser(null);
    setCounts(null);
    setState('signed-out');
    window.location.href = '/';
  }

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className="brand" aria-label="NowMyWork home">
          <img src="https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png" alt="" className="brand-logo" />
          <span>NowMyWork</span>
        </Link>
        <span className={styles.secure}><span aria-hidden="true">●</span> Secure admin area</span>
        {user && <button className="ghost-btn" type="button" onClick={() => void signOut()}>Sign out</button>}
      </header>

      {state === 'checking' && (
        <section className={styles.gate} aria-live="polite">
          <div className="eyebrow muted">ADMIN ACCESS</div>
          <h1>Verifying your account.</h1>
          <p>Checking Google sign-in, email verification, and admin authorization.</p>
        </section>
      )}

      {state === 'signed-out' && (
        <section className={styles.gate}>
          <div className="eyebrow muted">ADMIN ACCESS</div>
          <h1>Admin sign-in required.</h1>
          <p>Continue with Google using a verified email explicitly authorized for NowMyWork administration.</p>
          <Link className="primary-btn" href="/admin/signin">Sign in to continue →</Link>
        </section>
      )}

      {state === 'denied' && (
        <section className={styles.gate}>
          <div className="eyebrow muted">ACCESS DENIED</div>
          <h1>This account cannot access the admin panel.</h1>
          <p>{message || 'Use Google sign-in with an email verified in Firebase Authentication and listed in the server-only ADMIN_EMAILS allowlist.'}</p>
          <div className={styles.actions}>
            <button className="primary-btn" type="button" onClick={() => void signOut()}>Sign out and switch account</button>
            <Link className="secondary-btn" href="/">Back to homepage</Link>
          </div>
        </section>
      )}

      {state === 'authorized' && user && (
        <div className={styles.content}>
          <div className={styles.intro}>
            <div className="eyebrow muted">AUTHORIZED ADMIN WORKSPACE</div>
            <h1>Marketplace control room.</h1>
            <p>Signed in as <strong>{user.email}</strong>. Admin tools are isolated from client and freelancer dashboards.</p>
          </div>

          <section className={styles.metrics} aria-label="Marketplace overview">
            {([
              ['Clients', counts?.users],
              ['Freelancers', counts?.freelancers],
              ['Jobs', counts?.jobs],
              ['Offers', counts?.offers],
            ] as const).map(([label, value], index) => (
              <article className={styles.metric} key={label}>
                <span>0{index + 1}</span>
                <h2>{value ?? '—'}</h2>
                <p>{label}</p>
              </article>
            ))}
          </section>

          <AdminFreelancerApprovals user={user} />
        </div>
      )}
    </main>
  );
}
