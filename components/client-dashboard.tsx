'use client';

import { FormEvent, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { createJob, getClientJobs, parseList, type JobPriority, type JobRecord } from '@/lib/jobs';
import styles from './client-dashboard.module.css';

type Props = {
  user: NonNullable<typeof auth.currentUser>;
};

const priorityLabels: Record<JobPriority, { title: string; text: string }> = {
  QUALITY: { title: 'A — Quality First', text: 'Prioritize proven skill, quality and experience.' },
  BALANCED: { title: 'B — Balanced', text: 'Balance quality, availability and budget.' },
  SPEED_BUDGET: { title: 'C — Budget / Speed First', text: 'Prioritize availability, speed and cost.' },
};

function formatDate(job: JobRecord) {
  const date = job.createdAt?.toDate();
  return date ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Just now';
}

export default function ClientDashboard({ user }: Props) {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [skills, setSkills] = useState('');
  const [techStack, setTechStack] = useState('');
  const [priority, setPriority] = useState<JobPriority>('BALANCED');

  async function loadJobs() {
    setLoadingJobs(true);
    try {
      setJobs(await getClientJobs(user.uid));
    } catch {
      setError('We could not load your jobs. Please try again.');
    } finally {
      setLoadingJobs(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, [user.uid]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const amount = Number(budget);
    const days = Number(durationDays);
    const skillList = parseList(skills);
    const stackList = parseList(techStack);

    if (!title.trim() || !description.trim()) {
      setError('Add a title and description for the work.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid budget greater than ₹0.');
      return;
    }
    if (!Number.isInteger(days) || days <= 0) {
      setError('Enter a valid duration in days.');
      return;
    }
    if (skillList.length === 0) {
      setError('Add at least one required skill.');
      return;
    }

    setSaving(true);
    try {
      await createJob({
        clientId: user.uid,
        title: title.trim(),
        description: description.trim(),
        budget: Math.round(amount),
        durationDays: days,
        skills: skillList,
        techStack: stackList,
        priority,
      });
      setTitle('');
      setDescription('');
      setBudget('');
      setDurationDays('7');
      setSkills('');
      setTechStack('');
      setPriority('BALANCED');
      setShowForm(false);
      setSuccess('Your work is posted. Next, NowMyWork will match it to the best-fit freelancers.');
      await loadJobs();
    } catch {
      setError('We could not post this job. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.shell}>
      <div className={styles.topRow}>
        <div>
          <div className="eyebrow muted">CLIENT WORKSPACE</div>
          <h1 className={styles.heading}>Get the right person for the work.</h1>
          <p className={styles.sub}>Post what you need. NowMyWork handles the matching instead of making you manage a pile of proposals.</p>
        </div>
        <button className="primary-btn" onClick={() => { setShowForm((value) => !value); setError(''); setSuccess(''); }}>
          {showForm ? 'Close form' : '+ Post work'}
        </button>
      </div>

      {success && <div className={styles.success} role="status">{success}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      {showForm && (
        <form className={styles.formCard} onSubmit={submit}>
          <div className={styles.formIntro}>
            <div>
              <div className="eyebrow muted">NEW PROJECT</div>
              <h2>Tell us what needs to get done.</h2>
            </div>
            <span>Private matching</span>
          </div>

          <label>Project title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Build a modern SaaS dashboard" required /></label>
          <label>What do you need?<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the outcome, scope and anything important for the freelancer to know." rows={5} required /></label>

          <div className={styles.twoCol}>
            <label>Budget (₹)<input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="50000" type="number" min="1" step="1" required /></label>
            <label>Duration (days)<input value={durationDays} onChange={(e) => setDurationDays(e.target.value)} type="number" min="1" step="1" required /></label>
          </div>

          <div className={styles.twoCol}>
            <label>Required skills<input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, UI design, TypeScript" required /></label>
            <label>Tech stack<input value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="Next.js, Firebase" /></label>
          </div>
          <p className={styles.hint}>Separate skills with commas. We’ll normalize them for matching.</p>

          <fieldset>
            <legend>What matters most?</legend>
            <div className={styles.priorityGrid}>
              {(Object.keys(priorityLabels) as JobPriority[]).map((key) => (
                <button key={key} type="button" className={priority === key ? styles.prioritySelected : styles.priority} onClick={() => setPriority(key)}>
                  <strong>{priorityLabels[key].title}</strong>
                  <span>{priorityLabels[key].text}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className={styles.formActions}>
            <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Posting…' : 'Post work →'}</button>
          </div>
        </form>
      )}

      <div className={styles.jobsHeader}>
        <div>
          <div className="eyebrow muted">YOUR JOBS</div>
          <h2>Work you’ve posted.</h2>
        </div>
        <span>{jobs.length} {jobs.length === 1 ? 'project' : 'projects'}</span>
      </div>

      {loadingJobs ? (
        <div className={styles.empty}>Loading your work…</div>
      ) : jobs.length === 0 ? (
        <div className={styles.empty}>
          <strong>Your first project starts here.</strong>
          <p>Post a job and NowMyWork will have the information it needs to start matching.</p>
          <button className="primary-btn" onClick={() => setShowForm(true)}>Post your first job →</button>
        </div>
      ) : (
        <div className={styles.jobsList}>
          {jobs.map((job) => (
            <article key={job.id} className={styles.jobCard}>
              <div className={styles.jobMain}>
                <div className={styles.jobMeta}><span>{job.status}</span><span>{formatDate(job)}</span></div>
                <h3>{job.title}</h3>
                <p>{job.description}</p>
                <div className={styles.chips}>
                  {job.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}
                  {job.skills.length > 4 && <span>+{job.skills.length - 4}</span>}
                </div>
              </div>
              <div className={styles.jobAside}>
                <strong>₹{job.budget.toLocaleString('en-IN')}</strong>
                <span>{job.durationDays} days</span>
                <span>{priorityLabels[job.priority].title.split(' — ')[0]} priority</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
