'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import styles from './admin-freelancer-approvals.module.css';

type ApprovalRequest = {
  freelancerId: string;
  name: string;
  email: string;
  roleTitle: string;
  status: string;
  videoStatus: string;
  submittedAt: string | null;
  mobileNumber: string;
  dateOfBirth: string;
  profileUrl: string;
  description: string;
  skills: string[];
  projectLinks: string[];
  experience: number;
};
type ApiData = { requests?: ApprovalRequest[]; error?: string };

async function parseResponse(response: Response) {
  const body = await response.text();
  if (!body.trim()) throw new Error('The server returned an empty response.');
  try { return JSON.parse(body) as ApiData; }
  catch { throw new Error('The server returned an invalid response.'); }
}

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
    : 'Date unavailable';
}

export default function AdminFreelancerApprovals({ user }: { user: User }) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/freelancer-approvals', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not load freelancer approval requests.');
      setRequests(data.requests ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load freelancer approval requests.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  async function review(request: ApprovalRequest, action: 'APPROVE' | 'REJECT') {
    setBusyId(request.freelancerId);
    setError('');
    setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/freelancer-approvals', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          freelancerId: request.freelancerId,
          action,
          note: notes[request.freelancerId] ?? '',
        }),
      });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not update this application.');
      setRequests((previous) => previous.filter((item) => item.freelancerId !== request.freelancerId));
      setMessage(`${request.name}'s application was ${action === 'APPROVE' ? 'approved' : 'rejected'}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update this application.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className="eyebrow muted">REVIEW QUEUE</div>
          <h2>Freelancer approval requests</h2>
          <p>Requests appear immediately after the main profile form is submitted. The introduction video is sent separately by email.</p>
        </div>
        <button className="secondary-btn" type="button" onClick={() => void loadRequests()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh queue'}
        </button>
      </div>

      {message && <div className={styles.success} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      {loading ? (
        <div className={styles.empty}>Loading approval requests…</div>
      ) : requests.length === 0 ? (
        <div className={styles.empty}><strong>No pending applications.</strong><p>When a freelancer submits the main profile form, the request will appear here immediately.</p></div>
      ) : (
        <div className={styles.list}>
          {requests.map((request) => (
            <article className={styles.card} key={request.freelancerId}>
              <div className={styles.cardHeader}>
                <div>
                  <h3>{request.name}</h3>
                  <a href={`mailto:${request.email}`}>{request.email}</a>
                  <p>{request.roleTitle} · {request.experience} years experience</p>
                </div>
                <span className={styles.pending}>Pending review</span>
              </div>

              <div className={styles.details}>
                <div><span>Mobile</span><strong>{request.mobileNumber || 'Not provided'}</strong></div>
                <div><span>Date of birth</span><strong>{request.dateOfBirth || 'Not provided'}</strong></div>
                <div><span>Submitted</span><strong>{formatDate(request.submittedAt)}</strong></div>
                <div><span>Video</span><strong>Awaiting email (not required to create the request)</strong></div>
              </div>

              <p className={styles.description}>{request.description}</p>
              <div className={styles.tagList}>{request.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>

              {(request.profileUrl || request.projectLinks.length > 0) && (
                <div className={styles.links}>
                  {request.profileUrl && <a href={request.profileUrl} target="_blank" rel="noreferrer">Open profile / portfolio ↗</a>}
                  {request.projectLinks.map((link) => <a href={link} target="_blank" rel="noreferrer" key={link}>{link} ↗</a>)}
                </div>
              )}

              <label className={styles.noteLabel}>Review note (optional; shown if rejected)
                <textarea
                  value={notes[request.freelancerId] ?? ''}
                  onChange={(event) => setNotes((previous) => ({ ...previous, [request.freelancerId]: event.target.value }))}
                  rows={2}
                  maxLength={1000}
                  placeholder="Share feedback or the next step for the applicant."
                />
              </label>

              <div className={styles.actions}>
                <button className="secondary-btn" type="button" onClick={() => void review(request, 'REJECT')} disabled={busyId === request.freelancerId}>
                  {busyId === request.freelancerId ? 'Saving…' : 'Reject'}
                </button>
                <button className="primary-btn" type="button" onClick={() => void review(request, 'APPROVE')} disabled={busyId === request.freelancerId}>
                  {busyId === request.freelancerId ? 'Saving…' : 'Approve freelancer →'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
