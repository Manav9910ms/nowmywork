'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import ClientDashboard from '@/components/client-dashboard';
import FreelancerProfile from '@/components/freelancer-profile';
import FreelancerOffers from '@/components/freelancer-offers';
import NotificationsPanel from '@/components/notifications-panel';
import styles from './dashboard.module.css';

const brandIcon = 'https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png';
type AccountRole = 'CLIENT' | 'FREELANCER';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AccountRole | null>(null);
  const [checking, setChecking] = useState(true);
  const [roleError, setRoleError] = useState('');

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return;
      setUser(currentUser);

      if (!currentUser) {
        setRole(null);
        setChecking(false);
        return;
      }

      setChecking(true);
      try {
        const snapshot = await getDoc(doc(db, 'users', currentUser.uid));
        if (!active) return;
        const data = snapshot.data();
        const savedRole = data?.role;

        // Admin workspaces are served only from /admin, never from this dashboard.
        if (savedRole === 'ADMIN') {
          router.replace('/admin');
          return;
        }

        if (savedRole !== 'CLIENT' && savedRole !== 'FREELANCER') {
          setRoleError('We could not verify your account role. Please sign out and sign in again.');
          setRole(null);
          setChecking(false);
          return;
        }

        if (savedRole === 'FREELANCER') {
          const token = await currentUser.getIdToken();
          const applicationResponse = await fetch('/api/profile/freelancer/application', {
            headers: { authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          const application = await applicationResponse.json() as { status?: string; error?: string };
          if (!applicationResponse.ok) throw new Error(application.error ?? 'Could not verify your freelancer approval.');
          if (!active) return;
          if (application.status !== 'APPROVED') {
            router.replace('/freelancer/onboarding');
            return;
          }
        }

        setRoleError('');
        setRole(savedRole);
        setChecking(false);
      } catch (reason) {
        if (!active) return;
        setRole(null);
        setRoleError(reason instanceof Error ? reason.message : 'We could not verify your account role. Please refresh or sign in again.');
        setChecking(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  async function logout() {
    await logOut();
    window.location.href = '/';
  }

  if (checking) {
    return <main className={styles.page}><div className={styles.card}><p>Loading your workspace…</p></div></main>;
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <img src={brandIcon} alt="" className={styles.icon}/>
          <h1>Sign in required.</h1>
          <p>You need a NowMyWork account to access the dashboard.</p>
          <Link className="primary-btn" href="/signin">Go to sign in →</Link>
        </div>
      </main>
    );
  }

  if (!role) {
    return (
      <main className={styles.page}>
        <div className={styles.card}>
          <h1>Account role unavailable.</h1>
          <p>{roleError || 'We could not verify your account role.'}</p>
          <button className="primary-btn" onClick={logout}>Sign out and try again →</button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className="brand">
          <img src={brandIcon} alt="" className="brand-logo"/>
          <span>NowMyWork</span>
        </Link>
        <NotificationsPanel/>
        <button className="ghost-btn" onClick={logout}>Sign out</button>
      </header>
      {role === 'CLIENT'
        ? <ClientDashboard user={user}/>
        : <><FreelancerProfile user={user}/><FreelancerOffers freelancerId={user.uid}/></>}
    </main>
  );
}
