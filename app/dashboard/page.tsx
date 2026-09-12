'use client';

import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setChecking(false);
  }), []);

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
      <section className={styles.shell}>
        <div className="eyebrow muted">YOUR WORKSPACE</div>
        <h1 className={styles.heading}>Welcome{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.</h1>
        <p className={styles.sub}>Your account is connected. Next we’ll turn this into the full client and freelancer workspace.</p>
        <div className={styles.grid}>
          <article className={styles.tile}><span>01</span><h2>Profile</h2><p>Complete your role, skills, availability and portfolio.</p></article>
          <article className={styles.tile}><span>02</span><h2>Projects</h2><p>Post work or receive private matched opportunities.</p></article>
          <article className={styles.tile}><span>03</span><h2>Matching</h2><p>See how NowMyWork chooses the best-fit people.</p></article>
        </div>
      </section>
    </main>
  );
}
