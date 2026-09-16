'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import ClientDashboard from '@/components/client-dashboard';
import FreelancerProfile from '@/components/freelancer-profile';
import FreelancerOffers from '@/components/freelancer-offers';
import NotificationsPanel from '@/components/notifications-panel';
import styles from './dashboard.module.css';

const brandIcon = '/icon.png';
type AccountRole = 'CLIENT' | 'FREELANCER' | 'ADMIN';
type Counts = { users: number; freelancers: number; jobs: number; offers: number };

function AdminOverview({ user }: { user: User }) {
  const [counts, setCounts] = useState<Counts | null>(null); const [error, setError] = useState('');
  useEffect(() => { void (async () => { try { const token = await user.getIdToken(); const response = await fetch('/api/admin/overview', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' }); const data = await response.json() as { counts?: Counts; error?: string }; if (!response.ok) throw new Error(data.error ?? 'Could not load admin overview.'); setCounts(data.counts ?? null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load admin overview.'); } })(); }, [user]);
  return <section className={styles.shell}><div className="eyebrow muted">ADMIN WORKSPACE</div><h1 className={styles.heading}>Marketplace control room.</h1><p className={styles.sub}>Protected operational metrics and controls for NowMyWork administrators.</p>{error && <div className={styles.notificationEmpty} role="alert">{error}</div>}<div className={styles.grid}>{[['Users', counts?.users],['Freelancers', counts?.freelancers],['Jobs', counts?.jobs],['Offers', counts?.offers]].map(([label, value], index) => <article className={styles.tile} key={String(label)}><span>0{index + 1}</span><h2>{value ?? '—'}</h2><p>{label}</p></article>)}</div></section>;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null); const [role, setRole] = useState<AccountRole | null>(null); const [checking, setChecking] = useState(true);
  useEffect(() => onAuthStateChanged(auth, async (currentUser) => { setUser(currentUser); if (!currentUser) { setRole(null); setChecking(false); return; } try { const snapshot = await getDoc(doc(db, 'users', currentUser.uid)); setRole((snapshot.data()?.role as AccountRole | undefined) ?? 'CLIENT'); } catch { setRole('CLIENT'); } finally { setChecking(false); } }), []);
  async function logout() { await logOut(); window.location.href = '/'; }
  if (checking) return <main className={styles.page}><div className={styles.card}><p>Loading your workspace…</p></div></main>;
  if (!user) return <main className={styles.page}><div className={styles.card}><img src={brandIcon} alt="" className={styles.icon}/><h1>Sign in required.</h1><p>You need a NowMyWork account to access the dashboard.</p><Link className="primary-btn" href="/signin">Go to sign in →</Link></div></main>;
  return <main className={styles.page}><header className={styles.nav}><Link href="/" className="brand"><img src={brandIcon} alt="" className="brand-logo"/><span>NowMyWork</span></Link><NotificationsPanel/><button className="ghost-btn" onClick={logout}>Sign out</button></header>{role === 'CLIENT' ? <ClientDashboard user={user}/> : role === 'FREELANCER' ? <><FreelancerProfile user={user}/><FreelancerOffers freelancerId={user.uid}/></> : <AdminOverview user={user}/>}</main>;
}
