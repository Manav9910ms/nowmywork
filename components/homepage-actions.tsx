'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { auth, db, firebaseApp } from '@/lib/firebase';

type AccountRole = 'CLIENT' | 'FREELANCER' | 'ADMIN';
type Placement = 'hero' | 'cta';

export default function HomepageActions({ placement }: { placement: Placement }) {
  const [authStatus, setAuthStatus] = useState<'loading' | 'signed-out' | 'signed-in'>('loading');
  const [role, setRole] = useState<AccountRole | null>(null);
  const [freelancerApprovalStatus, setFreelancerApprovalStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseApp) {
      setAuthStatus('signed-out');
      return;
    }

    let requestNumber = 0;
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        const request = ++requestNumber;
        if (!currentUser) {
          setRole(null);
          setFreelancerApprovalStatus(null);
          setAuthStatus('signed-out');
          return;
        }

        // Hide guest actions immediately while the saved role is being loaded.
        setAuthStatus('signed-in');
        setRole(null);
        setFreelancerApprovalStatus(null);

        void getDoc(doc(db, 'users', currentUser.uid))
          .then((snapshot) => {
            if (request !== requestNumber) return;
            const savedRole = snapshot.data()?.role;
            setRole(
              savedRole === 'CLIENT' || savedRole === 'FREELANCER' || savedRole === 'ADMIN'
                ? savedRole
                : null,
            );
            setFreelancerApprovalStatus(typeof snapshot.data()?.freelancerApprovalStatus === 'string' ? snapshot.data()?.freelancerApprovalStatus : null);
          })
          .catch(() => {
            if (request === requestNumber) setRole(null);
          });
      },
      () => {
        // Fail closed: if auth cannot be resolved, do not show role-selection links.
        setRole(null);
        setAuthStatus('signed-in');
      },
    );

    return () => {
      requestNumber += 1;
      unsubscribe();
    };
  }, []);

  const containerClass = placement === 'hero' ? 'hero-actions' : 'cta-actions';
  const guestLinks = placement === 'hero'
    ? (
      <>
        <Link className="primary-btn" href="/signup">I need a freelancer <span>→</span></Link>
        <Link className="secondary-btn" href="/signup">I want work <span>→</span></Link>
      </>
    )
    : (
      <>
        <Link className="primary-btn light" href="/signup">Post a project <span>→</span></Link>
        <Link className="secondary-btn light-outline" href="/signup">Join as a freelancer</Link>
      </>
    );

  if (authStatus === 'loading') {
    return <div className={containerClass} aria-busy="true" aria-label="Checking account" />;
  }

  if (authStatus === 'signed-out') {
    return <div className={containerClass}>{guestLinks}</div>;
  }

  if (role === 'CLIENT') {
    return (
      <div className={containerClass}>
        <Link
          className={placement === 'hero' ? 'primary-btn' : 'primary-btn light'}
          href="/dashboard"
        >
          {placement === 'hero' ? 'I need a freelancer' : 'Post a project'} <span>→</span>
        </Link>
      </div>
    );
  }

  if (role === 'FREELANCER') {
    return (
      <div className={containerClass}>
        <Link
          className={placement === 'hero' ? 'primary-btn' : 'primary-btn light'}
          href={freelancerApprovalStatus === 'APPROVED' ? '/dashboard' : '/freelancer/onboarding'}
        >
          {freelancerApprovalStatus === 'APPROVED'
            ? (placement === 'hero' ? 'I want work' : 'View opportunities')
            : (placement === 'hero' ? 'Complete profile' : 'Application status')} <span>→</span>
        </Link>
      </div>
    );
  }

  // Admins or accounts whose role could not be loaded get only a dashboard link.
  return (
    <div className={containerClass}>
      <Link
        className={placement === 'hero' ? 'primary-btn' : 'primary-btn light'}
        href="/dashboard"
      >
        Open dashboard <span>→</span>
      </Link>
    </div>
  );
}
