'use client';

import { FormEvent, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { parseList } from '@/lib/jobs';
import styles from './client-dashboard.module.css';

type Props = { user: { uid: string; displayName: string | null; email: string | null } };
type Profile = { bio: string; hourlyRate: number | null; experience: number; rating: number; completedJobs: number; availability: 'AVAILABLE' | 'BUSY' | 'AWAY'; skills: string[]; techStack: string[]; portfolioUrl: string };
const emptyProfile: Profile = { bio: '', hourlyRate: null, experience: 0, rating: 0, completedJobs: 0, availability: 'AVAILABLE', skills: [], techStack: [], portfolioUrl: '' };

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
        const account = auth.currentUser;
        if (!account) throw new Error('Sign in is required.');
        const token = await account.getIdToken();
        const response = await fetch('/api/profile/freelancer', { headers: { authorization: `Bearer ${token}` } });
        const data = await response.json() as { profile?: Partial<Profile> | null; error?: string };
        if (!response.ok) throw new Error(data.error ?? 'Could not load your profile.');
        const next = data.profile;
        if (next) {
          setProfile({
            bio: typeof next.bio === 'string' ? next.bio : '',
            hourlyRate: typeof next.hourlyRate === 'number' ? next.hourlyRate : null,
            experience: typeof next.experience === 'number' ? next.experience : 0,
            rating: typeof next.rating === 'number' ? next.rating : 0,
            completedJobs: typeof next.completedJobs === 'number' ? next.completedJobs : 0,
            availability: next.availability === 'BUSY' || next.availability === 'AWAY' ? next.availability : 'AVAILABLE',
            skills: Array.isArray(next.skills) ? next.skills : [],
            techStack: Array.isArray(next.techStack) ? next.techStack : [],
            portfolioUrl: typeof next.portfolioUrl === 'string' ? next.portfolioUrl : '',
          });
          setSkills(Array.isArray(next.skills) ? next.skills.join(', ') : '');
          setTechStack(Array.isArray(next.techStack) ? next.techStack.join(', ') : '');
        }
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not load your freelancer profile.'); }
      finally { setLoading(false); }
    }
    void load();
  }, [user.uid]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(''); setError('');
    const parsedSkills = parseList(skills); const parsedTech = parseList(techStack);
    if (parsedSkills.length === 0) { setError('Add at least one skill so NowMyWork can match you.'); setSaving(false); return; }
    try {
      const account = auth.currentUser; if (!account) throw new Error('Sign in is required.');
      const token = await account.getIdToken();
      const response = await fetch('/api/profile/freelancer', { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ bio: profile.bio.trim(), hourlyRate: profile.hourlyRate, experience: Math.max(0, Math.round(profile.experience)), availability: profile.availability, skills: parsedSkills, techStack: parsedTech, portfolioUrl: profile.portfolioUrl.trim() }) });
      const data = await response.json() as { profile?: Profile; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Could not save your profile.');
      setProfile(data.profile ?? { ...profile, skills: parsedSkills, techStack: parsedTech });
      setMessage('Profile saved. Your skills and availability can now be used for matching.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not save your profile.'); }
    finally { setSaving(false); }
  }

  if (loading) return <section className={styles.shell}><div className={styles.empty}>Loading your freelancer profile…</div></section>;

  return <section className={styles.shell}>
    <div className={styles.topRow}><div><div className="eyebrow muted">FREELANCER PROFILE</div><h1 className={styles.heading}>Make your next project find you.</h1><p className={styles.sub}>Tell NowMyWork what you’re good at. We’ll use this profile to decide which private opportunities are a strong fit.</p></div><div className={styles.profileBadge}>{user.displayName || user.email || 'Freelancer'}</div></div>
    {message && <div className={styles.success} role="status">{message}</div>}{error && <div className={styles.error} role="alert">{error}</div>}
    <form className={styles.formCard} onSubmit={save}>
      <div className={styles.formIntro}><div><div className="eyebrow muted">YOUR FIT</div><h2>Give the matcher useful signals.</h2></div><span>Profile data stays yours</span></div>
      <label>Bio<textarea value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="Tell clients what you build, your strengths, and the kind of work you enjoy." rows={5} /></label>
      <div className={styles.twoCol}><label>Hourly rate (₹)<input value={profile.hourlyRate ?? ''} onChange={(e) => setProfile({ ...profile, hourlyRate: e.target.value === '' ? null : Number(e.target.value) })} type="number" min="0" /></label><label>Experience (years)<input value={profile.experience} onChange={(e) => setProfile({ ...profile, experience: Number(e.target.value) })} type="number" min="0" max="50" step="1" /></label></div>
      <label>Skills<input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, UI design, TypeScript" required /></label>
      <label>Tech stack<input value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="Next.js, Firebase, Node.js" /></label>
      <label>Portfolio URL<input value={profile.portfolioUrl} onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })} placeholder="https://yourportfolio.com" type="url" /></label>
      <fieldset><legend>Availability</legend><div className={styles.priorityGrid}>{(['AVAILABLE', 'AWAY', 'BUSY'] as const).map((value) => <button key={value} type="button" className={profile.availability === value ? styles.prioritySelected : styles.priority} onClick={() => setProfile({ ...profile, availability: value })}><strong>{value === 'AVAILABLE' ? 'Available' : value === 'AWAY' ? 'Away' : 'Busy'}</strong><span>{value === 'AVAILABLE' ? 'Ready to receive matched work.' : value === 'AWAY' ? 'Visible, but less likely to be selected.' : 'Do not send new opportunities.'}</span></button>)}</div></fieldset>
      <div className={styles.formActions}><button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Save freelancer profile →'}</button></div>
    </form>
    <div className={styles.jobsHeader}><div><div className="eyebrow muted">MATCHING READINESS</div><h2>Your profile signals.</h2></div><span>{profile.skills.length} skills</span></div>
    <div className={styles.jobsList}><article className={styles.jobCard}><div className={styles.jobMain}><div className={styles.jobMeta}><span>{profile.availability}</span><span>{profile.experience} years experience</span></div><h3>{profile.skills.length ? profile.skills.join(' · ') : 'Add your skills'}</h3><p>{profile.techStack.length ? `Tech: ${profile.techStack.join(', ')}` : 'Add your tech stack to improve technical fit.'}</p></div><div className={styles.jobAside}><strong>{profile.hourlyRate == null ? 'Rate not set' : `₹${profile.hourlyRate.toLocaleString('en-IN')}/hr`}</strong><span>{profile.completedJobs} completed</span><span>{profile.rating.toFixed(1)} rating</span></div></article></div>
  </section>;
}
