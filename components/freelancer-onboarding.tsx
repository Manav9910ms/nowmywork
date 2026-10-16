'use client';

import { onAuthStateChanged } from 'firebase/auth';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import styles from './client-dashboard.module.css';

type ApplicationStatus = 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
type Application = {
  name: string;
  email: string;
  mobileNumber: string;
  dateOfBirth: string;
  profileUrl: string;
  description: string;
  skills: string[];
  roleTitle: string;
  projectLinks: string[];
  experience: number;
  submittedAt?: string | null;
};
type ApiData = { status?: ApplicationStatus; application?: Partial<Application> | null; reviewNote?: string; message?: string; error?: string };

const emptyApplication: Application = {
  name: '',
  email: '',
  mobileNumber: '',
  dateOfBirth: '',
  profileUrl: '',
  description: '',
  skills: [],
  roleTitle: '',
  projectLinks: [],
  experience: 0,
};

function listFromText(value: string) {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean).filter((item, index, all) => all.indexOf(item) === index);
}

async function readJson(response: Response) {
  const body = await response.text();
  if (!body.trim()) throw new Error(`The server returned an empty response (${response.status}). Please try again.`);
  try {
    return JSON.parse(body) as ApiData;
  } catch {
    throw new Error('The server returned an invalid response. Please try again.');
  }
}

function normalizeApplication(value?: Partial<Application> | null): Application {
  return {
    name: typeof value?.name === 'string' ? value.name : '',
    email: typeof value?.email === 'string' ? value.email : '',
    mobileNumber: typeof value?.mobileNumber === 'string' ? value.mobileNumber : '',
    dateOfBirth: typeof value?.dateOfBirth === 'string' ? value.dateOfBirth : '',
    profileUrl: typeof value?.profileUrl === 'string' ? value.profileUrl : '',
    description: typeof value?.description === 'string' ? value.description : '',
    skills: Array.isArray(value?.skills) ? value.skills : [],
    roleTitle: typeof value?.roleTitle === 'string' ? value.roleTitle : '',
    projectLinks: Array.isArray(value?.projectLinks) ? value.projectLinks : [],
    experience: typeof value?.experience === 'number' ? value.experience : 0,
    submittedAt: typeof value?.submittedAt === 'string' ? value.submittedAt : null,
  };
}

export default function FreelancerOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<ApplicationStatus>('NOT_SUBMITTED');
  const [application, setApplication] = useState<Application>(emptyApplication);
  const [skillsText, setSkillsText] = useState('');
  const [projectLinksText, setProjectLinksText] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const maxDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/signin');
        return;
      }
      void (async () => {
        setLoading(true);
        setError('');
        try {
          const token = await user.getIdToken();
          const response = await fetch('/api/profile/freelancer/application', {
            headers: { authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          const data = await readJson(response);
          if (!response.ok) throw new Error(data.error ?? 'Could not load your application.');
          if (!active) return;
          const nextStatus = data.status ?? 'NOT_SUBMITTED';
          if (nextStatus === 'APPROVED') {
            router.replace('/dashboard');
            return;
          }
          const next = normalizeApplication(data.application);
          if (!next.name) next.name = user.displayName ?? '';
          if (!next.email) next.email = user.email ?? '';
          setApplication(next);
          setSkillsText(next.skills.join(', '));
          setProjectLinksText(next.projectLinks.join('\n'));
          setStatus(nextStatus);
          setReviewNote(data.reviewNote ?? '');
        } catch (reason) {
          if (active) setError(reason instanceof Error ? reason.message : 'Could not load your freelancer application.');
        } finally {
          if (active) setLoading(false);
        }
      })();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  function update<K extends keyof Application>(field: K, value: Application[K]) {
    setApplication((previous) => ({ ...previous, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const skills = listFromText(skillsText);
    const projectLinks = listFromText(projectLinksText);
    if (!skills.length) {
      setError('Add at least one skill.');
      return;
    }
    if (projectLinks.length > 10) {
      setError('Add no more than 10 project or work links.');
      return;
    }
    if (projectLinks.some((link) => {
      try { return !['http:', 'https:'].includes(new URL(link).protocol); } catch { return true; }
    })) {
      setError('Each project/work link must be a complete URL starting with https:// or http://.');
      return;
    }

    setSaving(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in is required.');
      const token = await user.getIdToken();
      const response = await fetch('/api/profile/freelancer/application', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: application.name.trim(),
          email: application.email.trim(),
          mobileNumber: application.mobileNumber.trim(),
          dateOfBirth: application.dateOfBirth,
          profileUrl: application.profileUrl.trim(),
          description: application.description.trim(),
          skills,
          roleTitle: application.roleTitle.trim(),
          projectLinks,
          experience: Number(application.experience),
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not submit your application.');
      setApplication((previous) => ({ ...previous, skills, projectLinks }));
      setStatus('PENDING');
      setNotice(data.message ?? 'Your freelancer application has been submitted for review.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit your application.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className={styles.shell}><div className={styles.empty}>Loading your freelancer application…</div></main>;
  }

  if (status === 'PENDING') {
    const subject = encodeURIComponent(`Freelancer introduction video — ${application.name || application.email}`);
    return (
      <main className={styles.shell}>
        <div className={styles.topRow}>
          <div>
            <div className="eyebrow muted">FREELANCER APPLICATION</div>
            <h1 className={styles.heading}>Your profile is submitted.</h1>
            <p className={styles.sub}>Your approval request is already in the admin review queue. Now, please email an approximately 2-minute introduction video to team@nowmywork.com. Introduce yourself, describe your skills and work experience, and show one or two projects. You may show your face or record a faceless screen/voice walkthrough.</p>
          </div>
          <span className={styles.profileBadge}>Awaiting review</span>
        </div>
        {notice && <div className={styles.success} role="status">{notice}</div>}
        {error && <div className={styles.error} role="alert">{error}</div>}
        <section className={styles.formCard}>
          <div className={styles.formIntro}>
            <div><div className="eyebrow muted">NEXT STEP</div><h2>Record an approximately 2-minute video.</h2></div>
            <span>Face or faceless</span>
          </div>
          <p className={styles.onboardingText}>Introduce yourself briefly and talk through your skills, experience, and one or two examples of work. You may show your face or record a faceless screen/voice walkthrough. Keep it clear and around two minutes.</p>
          <ol className={styles.videoSteps}>
            <li>Record a short introduction and the type of work you do.</li>
            <li>Show or explain your relevant experience and a project or work sample.</li>
            <li>Email the video to <a href={`mailto:team@nowmywork.com?subject=${subject}`}>team@nowmywork.com</a> with the subject “Freelancer introduction video — {application.name || application.email}”.</li>
          </ol>
          <p className={styles.onboardingText}>Our team will review your application within 3 days. Your account stays pending until an admin approves it.</p>
          <div className={styles.formActions}>
            <a className="primary-btn" href={`mailto:team@nowmywork.com?subject=${subject}`}>Email the video to the team →</a>
            <button className="secondary-btn" type="button" onClick={() => router.push('/')}>Back to homepage</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.topRow}>
        <div>
          <div className="eyebrow muted">FREELANCER ONBOARDING · STEP 1</div>
          <h1 className={styles.heading}>Tell us about your work.</h1>
          <p className={styles.sub}>Complete your profile first. Our team reviews the application before you can use freelancer features.</p>
        </div>
        <span className={styles.profileBadge}>{status === 'REJECTED' ? 'Update application' : 'Required before dashboard'}</span>
      </div>
      {status === 'REJECTED' && <div className={styles.error} role="status">Your last application was not approved.{reviewNote ? ` Review note: ${reviewNote}` : ' You can update your details and submit again.'}</div>}
      {notice && <div className={styles.success} role="status">{notice}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <form className={styles.formCard} onSubmit={submit}>
        <div className={styles.formIntro}>
          <div><div className="eyebrow muted">YOUR PROFILE</div><h2>Freelancer application</h2></div>
          <span>Required</span>
        </div>
        <div className={styles.twoCol}>
          <label>Full name
            <input value={application.name} onChange={(event) => update('name', event.target.value)} autoComplete="name" maxLength={100} required />
          </label>
          <label>Email address
            <input value={application.email} type="email" readOnly aria-readonly="true" autoComplete="email" required />
            <span className={styles.hint}>This must match your signed-in account email.</span>
          </label>
        </div>
        <div className={styles.twoCol}>
          <label>Mobile number
            <input value={application.mobileNumber} onChange={(event) => update('mobileNumber', event.target.value)} type="tel" autoComplete="tel" placeholder="+91 98765 43210" maxLength={24} required />
          </label>
          <label>Date of birth
            <input value={application.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} type="date" max={maxDate} required />
          </label>
        </div>
        <label>Professional role / title
          <input value={application.roleTitle} onChange={(event) => update('roleTitle', event.target.value)} placeholder="Website developer" maxLength={100} required />
        </label>
        <label>Description
          <textarea value={application.description} onChange={(event) => update('description', event.target.value)} placeholder="Briefly describe your strengths, services, and the work you can deliver." minLength={20} maxLength={3000} rows={5} required />
        </label>
        <label>Skills
          <input value={skillsText} onChange={(event) => setSkillsText(event.target.value)} placeholder="HTML, CSS, JavaScript, React" required />
          <span className={styles.hint}>Separate skills with commas.</span>
        </label>
        <div className={styles.twoCol}>
          <label>Experience (years)
            <input value={application.experience} onChange={(event) => update('experience', Number(event.target.value))} type="number" min="0" max="50" step="0.5" required />
          </label>
          <label>Profile URL (optional)
            <input value={application.profileUrl} onChange={(event) => update('profileUrl', event.target.value)} type="url" placeholder="https://your-portfolio.com" maxLength={500} />
          </label>
        </div>
        <label>Projects and work links (optional)
          <textarea value={projectLinksText} onChange={(event) => setProjectLinksText(event.target.value)} placeholder={'https://github.com/yourname/project\nhttps://your-portfolio.com/work'} rows={3} />
          <span className={styles.hint}>Add up to 10 links, one per line. GitHub, portfolio, live websites, and case studies are all fine.</span>
        </label>
        <div className={styles.formActions}>
          <button type="button" className="secondary-btn" onClick={() => router.push('/')}>Cancel</button>
          <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Submitting application…' : 'Submit profile for approval →'}</button>
        </div>
      </form>
    </main>
  );
}
