'use client';

import { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createPrivateOffers } from '@/lib/offers';
import { selectTopFreelancers, type ScoredCandidate, type FreelancerCandidate, type JobForMatching } from '@/lib/matching';
import type { JobRecord } from '@/lib/jobs';
import styles from './client-dashboard.module.css';

type Props = {
  job: JobRecord;
};

type CandidateDoc = ScoredCandidate & {
  displayName?: string;
};

export default function MatchResults({ job }: Props) {
  const [matches, setMatches] = useState<CandidateDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [offersSent, setOffersSent] = useState(job.status === 'OFFERED');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function findMatches() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const snapshot = await getDocs(query(collection(db, 'freelancers'), where('availability', '!=', 'BUSY')));
      const candidates = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }) as FreelancerCandidate)
        .filter((candidate) => candidate.id !== job.clientId);

      const selected = selectTopFreelancers(
        {
          skills: job.skills,
          techStack: job.techStack,
          budget: job.budget,
          durationDays: job.durationDays,
          priority: job.priority,
        } satisfies JobForMatching,
        candidates,
        10,
      );

      const names = new Map(
        snapshot.docs.map((item) => [item.id, item.data().displayName as string | undefined]),
      );

      setMatches(selected.map((candidate) => ({ ...candidate, displayName: names.get(candidate.id) })));
      setLoaded(true);
    } catch {
      setError('We could not calculate matches right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function sendOffers() {
    if (matches.length === 0) return;
    setSending(true);
    setError('');
    setMessage('');
    try {
      await createPrivateOffers(job, matches);
      setOffersSent(true);
      setMessage(`${matches.length} private ${matches.length === 1 ? 'offer has' : 'offers have'} been sent.`);
    } catch {
      setError('We could not send the private offers. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.matchPanel}>
      <div className={styles.matchHeader}>
        <div>
          <div className="eyebrow muted">PRIVATE MATCHING</div>
          <h4>Top matches for this project</h4>
        </div>
        <div className={styles.matchActions}>
          <button className="secondary-btn" type="button" onClick={findMatches} disabled={loading || sending}>
            {loading ? 'Matching…' : loaded ? 'Refresh matches' : 'Find top 10 →'}
          </button>
          {loaded && matches.length > 0 && (
            <button className="primary-btn" type="button" onClick={sendOffers} disabled={sending || offersSent}>
              {sending ? 'Sending…' : offersSent ? 'Offers sent ✓' : `Send ${matches.length} private ${matches.length === 1 ? 'offer' : 'offers'} →`}
            </button>
          )}
        </div>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {message && <div className={styles.success} role="status">{message}</div>}

      {loaded && matches.length === 0 && (
        <div className={styles.matchEmpty}>
          <strong>No strong candidates yet.</strong>
          <p>Add more freelancers or broaden the required skills/tech stack.</p>
        </div>
      )}

      {matches.length > 0 && (
        <div className={styles.matchesList}>
          {matches.map((candidate, index) => (
            <article key={candidate.id} className={styles.matchCard}>
              <div className={styles.rank}>#{index + 1}</div>
              <div className={styles.matchInfo}>
                <strong>{candidate.displayName || 'Freelancer'}</strong>
                <span>{candidate.skills.slice(0, 3).join(' · ') || 'Skills not listed'}</span>
                <small>{candidate.availability} · {candidate.experience ?? 0} yrs · {candidate.completedJobs} completed</small>
              </div>
              <div className={styles.matchScore}>
                <strong>{candidate.score.toFixed(0)}</strong>
                <span>match</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
