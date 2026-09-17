'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import styles from './freelancer-offers.module.css';

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'SUPERSEDED';
type Offer = { id: string; jobId: string; title: string; description: string; budget: number; durationDays: number; skills: string[]; score: number; status: OfferStatus; expiresAt?: string | { _seconds?: number; seconds?: number } | null };

function expiryDate(value: Offer['expiresAt']) {
  if (typeof value === 'string') { const date = new Date(value); return Number.isFinite(date.getTime()) ? date : null; }
  const seconds = value?._seconds ?? value?.seconds;
  return typeof seconds === 'number' ? new Date(seconds * 1000) : null;
}
function formatExpiry(value: Offer['expiresAt']) {
  const date = expiryDate(value);
  return date ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date) : 'No expiry set';
}
function displayedStatus(offer: Offer): OfferStatus {
  return offer.status === 'PENDING' && expiryDate(offer.expiresAt)?.getTime() !== undefined && (expiryDate(offer.expiresAt)?.getTime() ?? Infinity) <= Date.now() ? 'EXPIRED' : offer.status;
}

export default function FreelancerOffers({ freelancerId }: { freelancerId: string }) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadOffers() {
    setLoading(true); setError('');
    try {
      const user = auth.currentUser;
      if (!user || user.uid !== freelancerId) throw new Error('Sign in is required.');
      const token = await user.getIdToken();
      const response = await fetch('/api/offers', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data = await response.json() as { offers?: Offer[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Could not load private opportunities.');
      setOffers(data.offers ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not load your private opportunities.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadOffers(); }, [freelancerId]);

  async function respond(offer: Offer, action: 'ACCEPTED' | 'DECLINED') {
    if (displayedStatus(offer) !== 'PENDING') return;
    setBusyId(offer.id); setMessage(''); setError('');
    try {
      const user = auth.currentUser; if (!user) throw new Error('Sign in is required.');
      const token = await user.getIdToken();
      const response = await fetch('/api/offers', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ offerId: offer.id, action }) });
      const data = await response.json() as { error?: string; status?: OfferStatus };
      if (!response.ok) throw new Error(data.error ?? 'Could not update this offer.');
      setOffers((current) => current.map((item) => item.id === offer.id ? { ...item, status: action } : action === 'ACCEPTED' && item.status === 'PENDING' ? { ...item, status: 'SUPERSEDED' } : item));
      setMessage(action === 'ACCEPTED' ? 'Project accepted. This opportunity is now assigned to you.' : 'Offer declined.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not update this offer.'); }
    finally { setBusyId(null); }
  }

  const decoratedOffers = offers.map((offer) => ({ offer, status: displayedStatus(offer) }));
  const pendingOffers = decoratedOffers.filter(({ status }) => status === 'PENDING');

  return <section className={styles.section}>
    <div className={styles.header}><div><div className="eyebrow muted">PRIVATE OPPORTUNITIES</div><h2>Work matched to you.</h2><p>No bidding. These are opportunities NowMyWork selected specifically for your profile.</p></div><span>{pendingOffers.length} pending</span></div>
    {message && <div className={styles.success} role="status">{message}</div>}{error && <div className={styles.error} role="alert">{error}</div>}
    {loading ? <div className={styles.empty}>Loading your opportunities…</div> : offers.length === 0 ? <div className={styles.empty}><strong>No private opportunities yet.</strong><p>Keep your skills and availability updated. New matching work will appear here.</p></div> : <div className={styles.list}>{decoratedOffers.map(({ offer, status }) => <article key={offer.id} className={styles.card}>
      <div className={styles.cardTop}><div><span className={styles.status}>{status}</span><h3>{offer.title}</h3></div><div className={styles.score}><strong>{offer.score.toFixed(0)}</strong><span>match</span></div></div>
      <p className={styles.description}>{offer.description}</p><div className={styles.meta}><span>₹{offer.budget.toLocaleString('en-IN')}</span><span>{offer.durationDays} days</span><span>{offer.skills.slice(0, 3).join(' · ')}</span></div>
      <div className={styles.bottom}><span>Offer expires {formatExpiry(offer.expiresAt)}</span>{status === 'PENDING' && <div className={styles.actions}><button className="secondary-btn" type="button" disabled={busyId === offer.id} onClick={() => void respond(offer, 'DECLINED')}>Decline</button><button className="primary-btn" type="button" disabled={busyId === offer.id} onClick={() => void respond(offer, 'ACCEPTED')}>{busyId === offer.id ? 'Updating…' : 'Accept project →'}</button></div>}{status === 'ACCEPTED' && <div className={styles.actions}><strong className={styles.accepted}>Assigned to you ✓</strong><Link href={`/project/${offer.jobId}`} className="secondary-btn">Open project →</Link></div>}</div>
    </article>)}</div>}
  </section>;
}
