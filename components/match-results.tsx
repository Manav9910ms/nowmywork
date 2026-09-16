'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import type { JobRecord } from '@/lib/jobs';
import type { MatchReason } from '@/lib/matching';
import styles from './client-dashboard.module.css';

type Props = { job: JobRecord };
type Match = { id: string; score: number; skills: string[]; techStack: string[]; availability: string; experience?: number | null; completedJobs: number; reasons?: MatchReason[] };

export default function MatchResults({ job }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(0);

  async function findMatches() {
    setLoading(true); setError(''); setMessage('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in is required.');
      const token = await user.getIdToken();
      const response = await fetch('/api/matching', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ jobId: job.id }) });
      const data = await response.json() as { error?: string; count?: number; matches?: Match[] };
      if (!response.ok) throw new Error(data.error ?? 'Could not calculate matches.');
      setMatches(data.matches ?? []); setCount(data.count ?? 0); setLoaded(true);
      setMessage(data.count ? `${data.count} private opportunities prepared.` : 'No eligible freelancer currently satisfies every required skill.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not calculate matches right now.');
    } finally { setLoading(false); }
  }

  return (
    <div className={styles.matchPanel}>
      <div className={styles.matchHeader}><div><div className="eyebrow muted">PRIVATE MATCHING</div><h4>{job.status === 'OFFERED' ? 'Private offers prepared' : 'Find eligible freelancers'}</h4></div><button className="secondary-btn" type="button" onClick={() => void findMatches()} disabled={loading || ['ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(job.status)}>{loading ? 'Matching…' : loaded ? 'Rematch securely' : 'Find top matches →'}</button></div>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {message && <div className={styles.success} role="status">{message}</div>}
      {loaded && count > 0 && <div className={styles.matchSummary}><strong>Top {count}</strong><span>Eligible freelancers have received private offers. Individual offer details stay private to them.</span></div>}
      {loaded && count === 0 && <div className={styles.matchEmpty}><strong>No eligible candidates yet.</strong><p>Required skills are hard eligibility rules. You can update the project requirements and run matching again.</p></div>}
      {matches.length > 0 && <div className={styles.matchesList}>{matches.map((candidate, index) => <article key={candidate.id} className={styles.matchCard}><div className={styles.rank}>#{index + 1}</div><div className={styles.matchInfo}><strong>Matched freelancer</strong><span>{candidate.skills.slice(0, 3).join(' · ') || 'Skills not listed'}</span><small>{candidate.availability} · {candidate.experience ?? 0} yrs · {candidate.completedJobs} completed</small><div className={styles.matchReasons}>{(candidate.reasons ?? []).slice(0, 3).map((reason) => <span key={reason.key}>✓ {reason.label}</span>)}</div></div><div className={styles.matchScore}><strong>{candidate.score.toFixed(0)}</strong><span>match</span></div></article>)}</div>}
    </div>
  );
}
