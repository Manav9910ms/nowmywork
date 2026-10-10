'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth, db, firebaseApp } from '@/lib/firebase';
import { logOut } from '@/lib/auth';

export default function SiteNav() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'CLIENT' | 'FREELANCER' | 'ADMIN' | null>(null);
  const [freelancerApprovalStatus, setFreelancerApprovalStatus] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  useEffect(() => {
    if (!firebaseApp) {
      setAuthReady(true);
      return;
    }

    return onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);
        setAuthReady(false);
        if (!currentUser) {
          setRole(null);
          setFreelancerApprovalStatus(null);
          setAuthReady(true);
          return;
        }
        try {
          const snapshot = await getDoc(doc(db, 'users', currentUser.uid));
          const savedRole = snapshot.data()?.role;
          setRole(savedRole === 'CLIENT' || savedRole === 'FREELANCER' || savedRole === 'ADMIN' ? savedRole : null);
          setFreelancerApprovalStatus(typeof snapshot.data()?.freelancerApprovalStatus === 'string' ? snapshot.data()?.freelancerApprovalStatus : null);
        } catch {
          setRole(null);
          setFreelancerApprovalStatus(null);
        } finally {
          setAuthReady(true);
        }
      },
      () => {
        setUser(null);
        setRole(null);
        setFreelancerApprovalStatus(null);
        setAuthReady(true);
      },
    );
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError('');

    try {
      await logOut();
    } catch {
      setSignOutError('Could not sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <nav className="nav shell" aria-label="Main navigation">
      <a className="brand" href="/" aria-label="NowMyWork home">
        <img
          src="https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png"
          alt=""
          className="brand-logo"
        />
        <span>NowMyWork</span>
      </a>

      <div className="nav-links">
        <a href="#how">How it works</a>
        <a href="#why">Why NowMyWork</a>
        <a href="#start">Get started</a>
      </div>

      <div className="nav-actions" aria-busy={!authReady}>
        {authReady && (
          user ? (
            <>
              <Link className="secondary-btn dashboard-link" href={role === 'FREELANCER' && freelancerApprovalStatus !== 'APPROVED' ? '/freelancer/onboarding' : '/dashboard'}>
                {role === 'FREELANCER' && freelancerApprovalStatus !== 'APPROVED' ? 'Complete profile' : 'Dashboard'}
              </Link>
              <button
                className="dark-btn"
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <Link className="ghost-btn" href="/signin">
                Sign in
              </Link>
              <Link className="dark-btn" href="/signup">
                Join NowMyWork
              </Link>
            </>
          )
        )}
      </div>

      {signOutError && (
        <span className="nav-error" role="alert">
          {signOutError}
        </span>
      )}
    </nav>
  );
}
