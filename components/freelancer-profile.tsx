'use client';

import { FormEvent, useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseList } from '@/lib/jobs';
import styles from './client-dashboard.module.css';

type Props = { user: { uid: string; displayName: string | null; email: string | null } };

type Profile = {
  bio: string;
  hourlyRate: number | null;
  experience: number;
  rating: number;
  completedJobs: number;
  availability: 'AVAILABLE' | 'BUSY' | 'AWAY';
  skills: string[];
  techStack: string[];
  portfolioUrl: string;
};

const emptyProfile: Profile = {
  bio: '', hourlyRate: null, experience: 0, rating: 0, completedJobs: 0,
  availability: 'AVAILABLE', skills: [], techStack: [], portfolioUrl: '',
};

export default function FreelancerProfile({ user }: Props) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [skills, setSkills] = useState('');
  const [techStack, setTechStack] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const snapshot = await getDoc(doc(db, 'freelancers', user.uid));
        if (snapshot.exists()) {
          const data = snapshot.data();
          setProfile({
            bio: typeof data.bio === 'string' ? data.bio : '',
            hourlyRate: typeof data.hourlyRate === 'number' ? data.hourlyRate : null,
            experience: typeof data.experience === 'number' ? data.experience : 0,
            rating: typeof data.rating === 'number' ? data.rating : 0,
            completedJobs: typeof data.completedJobs === 'number' ? data.completedJobs : 0,
            availability: data.availability === 'BUSY' || data.availability === 'AWAY' ? data.availability : 'AVAILABLE',
            skills: Array.isArray(data.skills) ? data.skills : [],
            techStack: Array.isArray(data.techStack) ? data.techStack : [],
            portfolioUrl: typeof data.portfolioUrl === 'string' ? data.portfolioUrl : '',
          });
          setSkills(Array.isArray(data.skills) ? data.skills.join(', ') : '');
          setTechStack(Array.isArray(data.techStack) ? data.techStack.join(', ') : '');
        }
      } catch {
        setError('We could not load your freelancer profile.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user.uid]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    const parsedSkills = parseList(skills);
    if (parsedSkills.length === 0) {
      setError('Add at least one skill so NowMyWork can match you.');
      setSaving(false);
      return;
    }
    try {
      await setDoc(doc(db, 'freelancers', user.uid), {
        userId: user.uid,
        displayName: user.displayName?.trim() || user.email?.split('@')[0] || 'Freelancer',
        bio: profile.bio.trim(),
        hourlyRate: profile.hourlyRate,
        experience: Math.max(0, Math.round(profile.experience)),
        rating: profile.rating,
        completedJobs: profile.completedJobs,
        availability: profile.availability,
        skills: parsedSkills,
        techStack: parseList(techStack),
        portfolioUrl: profile.portfolioUrl.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setProfile((current) => ({ ...current, skills: parsedSkills, techStack: parseList(techStack) }));
      setMessage('Profile saved. Your skills and availability can now be used for matching.');
    } catch {
      setError('We could not save your profile. Check your Firestore rules and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className={styles.shell}><div className={styles.empty}>Loading your freelancer profile…</div></section>;

  return (
    <section className={styles.shell}>
      <div className={styles.topRow}>
        <div>
          <div className="eyebrow muted">FREELANCER PROFILE</div>
          <h1 className={styles.heading}>Make your next project find you.</h1>
          <p className={styles.sub}>Tell NowMyWork what you’re good at. We’ll use this profile to decide which private opportunities are a strong fit.</p>
        </div>
        <div className={styles.profileBadge}>{user.displayName || user.email || 'Freelancer'}</div>
      </div>

      {message && <div className={styles.success} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <form className={styles.formCard} onSubmit={save}>
        <div className={styles.formIntro}>
          <div><div className="eyebrow muted">YOUR FIT</div><h2>Give the matcher useful signals.</h2></div>
          <span>Profile data stays yours</span>
        </div>
        <label>Bio<textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Tell clients what you build, your strengths, and the kind of work you enjoy." rows={5} /></label>
        <div className={styles.twoCol}>
          <label>Hourly rate (₹)<input value={profile.hourlyRate ?? ''} onChange={(e) => setProfile({ ...profile, hourlyRate: e.target.value === '' ? null : Number(e.target.value) })} type="number" min="0" /></label>
          <label>Experience (years)<input value={profile.experience} onChange={(e) => setProfile({ ...profile, experience: Number(e.target.value) })} type="number" min="0" max="50" step="1" /></label>
        </div>
        <label>Skills<input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, UI design, TypeScript" required /></label>
        <label>Tech stack<input value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="Next.js, Firebase, Node.js" /></label>
        <label>Portfolio URL<input value={profile.portfolioUrl} onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })} placeholder="https://yourportfolio.com" type="url" /></label>
        <fieldset>
          <legend>Availability</legend>
          <div className={styles.priorityGrid}>
            {(['AVAILABLE', 'AWAY', 'BUSY'] as const).map((value) => (
              <button key={value} type="button" className={profile.availability === value ? styles.prioritySelected : styles.priority} onClick={() => setProfile({ ...profile, availability: value })}>
                <strong>{value === 'AVAILABLE' ? 'Available' : value === 'AWAY' ? 'Away' : 'Busy'}</strong>
                <span>{value === 'AVAILABLE' ? 'Ready to receive matched work.' : value === 'AWAY' ? 'Visible, but less likely to be selected.' : 'Do not send new opportunities.'}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className={styles.formActions}><button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Save freelancer profile →'}</button></div>
      </form>

      <div className={styles.jobsHeader}><div><div className="eyebrow muted">MATCHING READINESS</div><h2>Your profile signals.</h2></div><span>{profile.skills.length} skills</span></div>
      <div className={styles.jobsList}>
        <article className={styles.jobCard}>
          <div className={styles.jobMain}>
            <div className={styles.jobMeta}><span>{profile.availability}</span><span>{profile.experience} years experience</span></div>
            <h3>{profile.skills.length ? profile.skills.join(' · ') : 'Add your skills'}</h3>
            <p>{profile.techStack.length ? `Tech: ${profile.techStack.join(', ')}` : 'Add your tech stack to improve technical fit.'}</p>
          </div>
          <div className={styles.jobAside}><strong>{profile.hourlyRate == null ? 'Rate not set' : `₹${profile.hourlyRate.toLocaleString('en-IN')}/hr`}</strong><span>{profile.completedJobs} completed</span><span>{profile.rating.toFixed(1)} rating</span></div>
        </article>
      </div>
    </section>
  );
}
