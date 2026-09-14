'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import ClientDashboard from '@/components/client-dashboard';
import styles from './dashboard.module.css';

type AccountRole = 'CLIENT' | 'FREELANCER' | 'ADMIN';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AccountRole | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setRole(null);
        setChecking(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, 'users', currentUser.uid));
        setRole((snapshot.data()?.role as AccountRole | undefined) ?? 'CLIENT');
      } catch {
        setRole('CLIENT');
      } finally {
        setChecking(false);
      }
    });
  }, []);

  async function logout() {
    await logOut();
    window.location.href = '/';
  }

  if (checking) return <main className={styles.page}><div className={styles.card}><p>Loading your workspace…</p></div></main>;

  if (!user) return <main className={styles.page}><div className={styles.card}><img src="/icon.png" alt="" className={styles.icon} /><h1>Sign in required.</h1><p>You need a NowMyWork account to access the dashboard.</p><Link className="primary-btn" href="/signin">Go to sign in →</Link></div></main>;

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className="brand"><img src="/icon.png" alt="" className="brand-logo" /><span>NowMyWork</span></Link>
        <button className="ghost-btn" onClick={logout}>Sign out</button>
      </header>

      {role === 'CLIENT' ? (
        <ClientDashboard user={user} />
      ) : (
        <section className={styles.shell}>
          <div className="eyebrow muted">{role === 'FREELANCER' ? 'FREELANCER WORKSPACE' : 'ADMIN WORKSPACE'}</div>
          <h1 className={styles.heading}>Welcome{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.</h1>
          <p className={styles.sub}>{role === 'FREELANCER' ? 'Your private opportunities and freelancer profile will appear here next.' : 'Your admin controls will appear here next.'}</p>
          <div className={styles.grid}>
            <article className={styles.tile}><span>01</span><h2>Profile</h2><p>Complete the information NowMyWork needs to understand your fit.</p></article>
            <article className={styles.tile}><span>02</span><h2>{role === 'FREELANCER' ? 'Opportunities' : 'Operations'}</h2><p>{role === 'FREELANCER' ? 'Private matched work will arrive here.' : 'Marketplace controls will arrive here.'}</p></article>
            <article className={styles.tile}><span>03</span><h2>Matching</h2><p>NowMyWork will use skills, tech stack, availability and priority to make better matches.</p></article>
          </div>
        </section>
      )}
    </main>
  );
}
