'use client';

import { useEffect, useState } from 'react';
import styles from './freelancer-offers.module.css';
import { getFreelancerOffers, respondToOffer, type JobOffer } from '@/lib/offers';

type Props = { freelancerId: string };

function formatExpiry(offer: JobOffer) {
  if (!offer.expiresAt) return 'No expiry set';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(offer.expiresAt.toDate());
}

export default function FreelancerOffers({ freelancerId }: Props) {
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadOffers() {
    setLoading(true);
    setError('');
    try {
      setOffers(await getFreelancerOffers(freelancerId));
    } catch {
      setError('We could not load your private opportunities.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOffers();
  }, [freelancerId]);

  async function respond(offer: JobOffer, response: 'ACCEPTED' | 'DECLINED') {
    setBusyId(offer.id);
    setMessage('');
    setError('');
    try {
      await respondToOffer(offer, response);
      setOffers((current) => current.map((item) => item.id === offer.id ? { ...item, status: response } : item));
      setMessage(response === 'ACCEPTED' ? 'Project accepted. This opportunity is now assigned to you.' : 'Offer declined.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not update this offer.');
    } finally {
      setBusyId(null);
    }
  }

  const pendingOffers = offers.filter((offer) => offer.status === 'PENDING');

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className="eyebrow muted">PRIVATE OPPORTUNITIES</div>
          <h2>Work matched to you.</h2>
          <p>No bidding. These are opportunities NowMyWork selected specifically for your profile.</p>
        </div>
        <span>{pendingOffers.length} pending</span>
      </div>

      {message && <div className={styles.success} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      {loading ? (
        <div className={styles.empty}>Loading your opportunities…</div>
      ) : offers.length === 0 ? (
        <div className={styles.empty}>
          <strong>No private opportunities yet.</strong>
          <p>Keep your skills and availability updated. New matching work will appear here.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {offers.map((offer) => (
            <article key={offer.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.status}>{offer.status}</span>
                  <h3>{offer.title}</h3>
                </div>
                <div className={styles.score}><strong>{offer.score.toFixed(0)}</strong><span>match</span></div>
              </div>
              <p className={styles.description}>{offer.description}</p>
              <div className={styles.meta}>
                <span>₹{offer.budget.toLocaleString('en-IN')}</span>
                <span>{offer.durationDays} days</span>
                <span>{offer.skills.slice(0, 3).join(' · ')}</span>
              </div>
              <div className={styles.bottom}>
                <span>Offer expires {formatExpiry(offer)}</span>
                {offer.status === 'PENDING' && (
                  <div className={styles.actions}>
                    <button className="secondary-btn" type="button" disabled={busyId === offer.id} onClick={() => respond(offer, 'DECLINED')}>Decline</button>
                    <button className="primary-btn" type="button" disabled={busyId === offer.id} onClick={() => respond(offer, 'ACCEPTED')}>{busyId === offer.id ? 'Updating…' : 'Accept project →'}</button>
                  </div>
                )}
                {offer.status === 'ACCEPTED' && <strong className={styles.accepted}>Assigned to you ✓</strong>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
