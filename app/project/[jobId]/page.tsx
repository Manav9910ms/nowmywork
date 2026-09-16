'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { getJob, updateJobStatus, type JobRecord, type JobStatus } from '@/lib/jobs';
import PaymentGate from '@/components/payment-gate';
import ProjectMessages from '@/components/project-messages';
import styles from './project.module.css';

type AccountRole = 'CLIENT' | 'FREELANCER' | 'ADMIN';
type FreelancerSummary = { displayName?: string; skills?: string[] };

const brandIcon = 'https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png';

function formatDate(timestamp?: JobRecord['createdAt']) {
  const date = timestamp?.toDate();
  return date ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : '—';
}

function getDeadline(job: JobRecord) {
  const created = job.createdAt?.toDate();
  if (!created) return 'Calculated from project start';
  const deadline = new Date(created);
  deadline.setDate(deadline.getDate() + job.durationDays);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(deadline);
}

const statusCopy: Record<JobStatus, string> = {
  OPEN: 'Waiting for matching', MATCHING: 'NowMyWork is finding the right fit', OFFERED: 'Private opportunities are being offered', ASSIGNED: 'The project has a freelancer assigned', IN_PROGRESS: 'The work is actively in progress', COMPLETED: 'The project is completed', CANCELLED: 'The project was cancelled',
};

export default function ProjectPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = params.jobId;
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AccountRole | null>(null);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [freelancer, setFreelancer] = useState<FreelancerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => onAuthStateChanged(auth, async (currentUser) => {
    setUser(currentUser);
    if (!currentUser) { setRole(null); setJob(null); setLoading(false); return; }
    try {
      const account = await getDoc(doc(db, 'users', currentUser.uid));
      setRole((account.data()?.role as AccountRole | undefined) ?? 'CLIENT');
      const loadedJob = await getJob(jobId);
      if (!loadedJob) { setError('This project could not be found.'); setLoading(false); return; }
      const isClient = loadedJob.clientId === currentUser.uid;
      const isAssignedFreelancer = loadedJob.assignedToId === currentUser.uid;
      if (!isClient && !isAssignedFreelancer) { setError('You do not have access to this project.'); setLoading(false); return; }
      setJob(loadedJob);
      if (loadedJob.assignedToId) {
        const profileSnapshot = await getDoc(doc(db, 'freelancers', loadedJob.assignedToId));
        if (profileSnapshot.exists()) {
          const data = profileSnapshot.data() as DocumentData;
          setFreelancer({ displayName: typeof data.displayName === 'string' ? data.displayName : undefined, skills: Array.isArray(data.skills) ? data.skills : [] });
        }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not load this project.'); }
    finally { setLoading(false); }
  }), [jobId]);

  async function changeStatus(nextStatus: Extract<JobStatus, 'IN_PROGRESS' | 'COMPLETED'>) {
    if (!job) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await updateJobStatus(job.id, nextStatus);
      setJob((current) => current ? { ...current, status: nextStatus } : current);
      setMessage(nextStatus === 'IN_PROGRESS' ? 'Project started. The work is now in progress.' : 'Project marked complete.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not update the project.'); }
    finally { setBusy(false); }
  }

  if (loading) return <main className={styles.page}><div className={styles.loading}>Loading project…</div></main>;
  if (!user) return <main className={styles.page}><section className={styles.narrow}><div className="eyebrow muted">PROJECT ACCESS</div><h1>Sign in required.</h1><p>Sign in to open this project workspace.</p><Link href="/signin" className="primary-btn">Go to sign in →</Link></section></main>;
  if (!job) return <main className={styles.page}><section className={styles.narrow}><div className="eyebrow muted">PROJECT NOT FOUND</div><h1>We couldn’t open this project.</h1><p>{error || 'The project may have been removed or you may not have access.'}</p><button className="secondary-btn" onClick={() => router.push('/dashboard')}>Back to dashboard</button></section></main>;

  const canStart = job.status === 'ASSIGNED';
  const canComplete = job.status === 'IN_PROGRESS';
  const canAct = role === 'FREELANCER' && job.assignedToId === user.uid;

  return <main className={styles.page}>
    <header className={styles.nav}><Link href="/dashboard" className="brand"><img src={brandIcon} alt="" className="brand-logo"/><span>NowMyWork</span></Link><Link href="/dashboard" className="ghost-btn">Dashboard</Link></header>
    <section className={styles.shell}>
      <Link href="/dashboard" className={styles.back}>← Back to dashboard</Link>
      {message && <div className={styles.success} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.heroRow}><div><div className="eyebrow muted">PROJECT WORKSPACE</div><div className={styles.statusPill}>{job.status}</div><h1>{job.title}</h1><p>{statusCopy[job.status]}</p></div><div className={styles.actions}>{canAct && canStart && <button className="primary-btn" disabled={busy} onClick={() => void changeStatus('IN_PROGRESS')}>{busy ? 'Starting…' : 'Start project →'}</button>}{canAct && canComplete && <button className="primary-btn" disabled={busy} onClick={() => void changeStatus('COMPLETED')}>{busy ? 'Updating…' : 'Mark complete →'}</button>}{job.status === 'COMPLETED' && <span className={styles.completed}>Completed ✓</span>}</div></div>
      <div className={styles.grid}><section className={styles.mainCard}><div className="eyebrow muted">PROJECT DETAILS</div><h2>What needs to get done.</h2><p className={styles.description}>{job.description}</p><div className={styles.chips}>{job.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>{job.techStack.length > 0 && <div className={styles.tech}><strong>Tech stack</strong><span>{job.techStack.join(' · ')}</span></div>}</section><aside className={styles.sideCard}><div className="eyebrow muted">PROJECT TERMS</div><div className={styles.term}><span>Budget</span><strong>₹{job.budget.toLocaleString('en-IN')}</strong></div><div className={styles.term}><span>Duration</span><strong>{job.durationDays} days</strong></div><div className={styles.term}><span>Posted</span><strong>{formatDate(job.createdAt)}</strong></div><div className={styles.term}><span>Target date</span><strong>{getDeadline(job)}</strong></div><div className={styles.term}><span>Priority</span><strong>{job.priority === 'QUALITY' ? 'Quality First' : job.priority === 'SPEED_BUDGET' ? 'Budget / Speed' : 'Balanced'}</strong></div></aside></div>
      {role && (role === 'CLIENT' || role === 'FREELANCER') && ['ASSIGNED', 'IN_PROGRESS'].includes(job.status) && <PaymentGate job={job} role={role} />}
      {role && ['CLIENT', 'FREELANCER'].includes(role) && ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'].includes(job.status) && <ProjectMessages jobId={job.id} />}
      <section className={styles.peopleCard}><div><div className="eyebrow muted">PEOPLE</div><h2>Project connection.</h2></div><div className={styles.personGrid}><div className={styles.person}><span>CLIENT</span><strong>{role === 'CLIENT' ? (user.displayName || 'You') : 'Project client'}</strong>{role === 'CLIENT' && <small>{user.email}</small>}</div><div className={styles.person}><span>FREELANCER</span><strong>{freelancer?.displayName || (job.assignedToId === user.uid ? (user.displayName || 'You') : 'Assigned freelancer')}</strong>{freelancer?.skills && <small>{freelancer.skills.slice(0, 3).join(' · ')}</small>}</div></div></section>
      <div className={styles.notice}><strong>Communication rule:</strong> direct contact details stay locked until the client completes the configured NowMyWork platform fee. Project messages remain available to both assigned participants.</div>
    </section>
  </main>;
}
