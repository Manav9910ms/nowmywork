'use client';

import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { logOut } from '@/lib/auth';

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

  if (checking) return <main className="dashboard-page"><div className="dashboard-card"><p>Loading your workspace…</p></div></main>;

  if (!user) return <main className="dashboard-page"><div className="dashboard-card"><img src="/icon.png" alt="" className="dashboard-icon" /><h1>Sign in required.</h1><p>You need a NowMyWork account to access the dashboard.</p><Link className="primary-btn" href="/signin">Go to sign in →</Link></div></main>;

  return <main className="dashboard-page"><header className="dashboard-nav"><Link href="/" className="brand"><img src="/icon.png" alt="" className="brand-logo" /><span>NowMyWork</span></Link><button className="ghost-btn" onClick={logout}>Sign out</button></header><section className="dashboard-shell"><div className="eyebrow muted">YOUR WORKSPACE</div><h1>Welcome{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.</h1><p className="dashboard-sub">Your account is connected. Next we’ll turn this into the full client and freelancer workspace.</p><div className="dashboard-grid"><article><span>01</span><h2>Profile</h2><p>Complete your role, skills, availability and portfolio.</p></article><article><span>02</span><h2>Projects</h2><p>Post work or receive private matched opportunities.</p></article><article><span>03</span><h2>Matching</h2><p>See how NowMyWork chooses the best-fit people.</p></article></div></section></main>;
}
