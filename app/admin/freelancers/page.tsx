'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { logOut } from '@/lib/auth';
import styles from './freelancers.module.css';

type Freelancer = {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  description: string;
  skills: string[];
  experience: number;
  availability: string;
  rating: number;
  applicationStatus: string;
  profileUrl: string;
  updatedAt: string | null;
};
type DirectoryResponse = { freelancers?: Freelancer[]; totalReturned?: number; error?: string };

async function readResponse(response: Response): Promise<DirectoryResponse> {
  const body = await response.text();
  if (!body.trim()) throw new Error('The server returned an empty response. Please try again.');
  try { return JSON.parse(body) as DirectoryResponse; }
  catch { throw new Error('The server returned an invalid response. Please try again.'); }
}

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
    : 'Date unavailable';
}

function statusLabel(value: string) {
  return value.toLowerCase().replaceAll('_', ' ');
}

export default function AdminFreelancersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<'checking' | 'signed-out' | 'denied' | 'authorized'>('checking');
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [query, setQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  const loadDirectory = useCallback(async (account: User, search: string, version?: number) => {
    const currentVersion = version ?? ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const token = await account.getIdToken();
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      const endpoint = '/api/admin/freelancers' + (params.size ? '?' + params.toString() : '');
      const response = await fetch(endpoint, {
        headers: { authorization: 'Bearer ' + token },
        cache: 'no-store',
      });
      const data = await readResponse(response);
      if (currentVersion !== requestVersion.current) return;
      if (!response.ok) {
        const message = data.error ?? 'Could not load freelancer profiles.';
        setError(message);
        setFreelancers([]);
        if ([401, 403, 503].includes(response.status)) setAuthState('denied');
        else setAuthState('authorized');
        return;
      }
      setFreelancers(data.freelancers ?? []);
      setActiveSearch(search.trim());
      setAuthState('authorized');
    } catch (reason) {
      if (currentVersion !== requestVersion.current) return;
      setError(reason instanceof Error ? reason.message : 'Could not load freelancer profiles.');
      setAuthState((previous) => previous === 'checking' ? 'denied' : previous);
    } finally {
      if (currentVersion === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const version = ++requestVersion.current;
      setUser(currentUser);
      setFreelancers([]);
      setError('');
      if (!currentUser) {
        setLoading(false);
        setAuthState('signed-out');
        return;
      }
      setAuthState('checking');
      void loadDirectory(currentUser, '', version);
    });
    return () => {
      requestVersion.current += 1;
      unsubscribe();
    };
  }, [loadDirectory]);

  async function signOut() {
    await logOut();
    window.location.href = '/';
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    if (term.length === 1) {
      setError('Enter at least 2 characters to search, or clear the field to see recent freelancers.');
      return;
    }
    if (!user) {
      setAuthState('signed-out');
      return;
    }
    await loadDirectory(user, term);
  }

  async function clearSearch() {
    setQuery('');
    setError('');
    if (user) await loadDirectory(user, '');
  }

  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <Link href="/" className="brand" aria-label="NowMyWork home">
          <img src="https://raw.githubusercontent.com/Manav9910ms/nowmywork/main/icon.png" alt="" className="brand-logo" />
          <span>NowMyWork</span>
        </Link>
        <div className={styles.navActions}>
          <span className={styles.secure}><span aria-hidden="true">●</span> Secure admin area</span>
          <Link href="/admin" className="secondary-btn">Admin overview</Link>
          {user && <button className="ghost-btn" type="button" onClick={() => void signOut()}>Sign out</button>}
        </div>
      </header>

      {authState === 'checking' && (
        <section className={styles.gate} aria-live="polite">
          <div className="eyebrow muted">ADMIN ACCESS</div>
          <h1>Verifying your account.</h1>
          <p>Checking Google sign-in, email verification, and admin authorization.</p>
        </section>
      )}

      {authState === 'signed-out' && (
        <section className={styles.gate}>
          <div className="eyebrow muted">ADMIN ACCESS</div>
          <h1>Admin sign-in required.</h1>
          <p>Continue with Google using an authorized, verified admin email.</p>
          <Link className="primary-btn" href="/admin/signin">Sign in to continue →</Link>
        </section>
      )}

      {authState === 'denied' && (
        <section className={styles.gate}>
          <div className="eyebrow muted">ACCESS DENIED</div>
          <h1>This account cannot access the freelancer directory.</h1>
          <p>{error || 'Use Google sign-in with a verified email authorized for NowMyWork administration.'}</p>
          <div className={styles.actions}>
            <button className="primary-btn" type="button" onClick={() => void signOut()}>Sign out and switch account</button>
            <Link className="secondary-btn" href="/admin/signin">Admin sign-in</Link>
          </div>
        </section>
      )}

      {authState === 'authorized' && (
        <div className={styles.content}>
          <Link href="/admin" className={styles.backLink}>← Back to admin overview</Link>
          <div className={styles.intro}>
            <div className="eyebrow muted">MARKETPLACE DIRECTORY</div>
            <h1>All freelancers.</h1>
            <p>Browse the 20 most recently updated profiles, or search the database by name, email, role, skills, or profile description.</p>
          </div>

          <form className={styles.searchForm} onSubmit={search} role="search">
            <label className={styles.searchLabel} htmlFor="freelancer-search">Search freelancer database</label>
            <div className={styles.searchRow}>
              <input
                id="freelancer-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, role, skill…"
                autoComplete="off"
                maxLength={120}
              />
              <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
              {(query || activeSearch) && <button className="secondary-btn" type="button" onClick={() => void clearSearch()} disabled={loading}>Clear</button>}
            </div>
            <p className={styles.searchHint}>Search runs on the server and returns at most 20 matching profiles. Leave the search empty to return to recent profiles.</p>
          </form>

          <div className={styles.resultsHeader}>
            <div>
              <h2>{activeSearch ? 'Search results' : 'Recently updated'}</h2>
              <p>{activeSearch ? 'Matches for “' + activeSearch + '” · showing up to 20 results' : 'Showing the 20 most recently updated freelancer profiles.'}</p>
            </div>
            <span className={styles.resultCount}>{freelancers.length} {freelancers.length === 1 ? 'profile' : 'profiles'}</span>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          {loading ? (
            <div className={styles.empty} aria-live="polite">Loading freelancer profiles…</div>
          ) : freelancers.length === 0 ? (
            <div className={styles.empty}>
              <strong>{activeSearch ? 'No matching freelancers found.' : 'No freelancer profiles yet.'}</strong>
              <p>{activeSearch ? 'Try a different name, email, role, or skill.' : 'New freelancer profiles will appear here after they are submitted.'}</p>
            </div>
          ) : (
            <div className={styles.list}>
              {freelancers.map((freelancer) => (
                <article className={styles.card} key={freelancer.id}>
                  <div className={styles.cardTop}>
                    <div>
                      <h3>{freelancer.name}</h3>
                      {freelancer.email ? <a href={'mailto:' + freelancer.email}>{freelancer.email}</a> : <span className={styles.muted}>Email not provided</span>}
                      <p className={styles.roleTitle}>{freelancer.roleTitle || 'Professional role not provided'}</p>
                    </div>
                    <span className={styles.status}>{statusLabel(freelancer.applicationStatus)}</span>
                  </div>
                  <div className={styles.meta}>
                    <span>{freelancer.experience} {freelancer.experience === 1 ? 'year' : 'years'} experience</span>
                    <span>{statusLabel(freelancer.availability)}</span>
                    <span>{freelancer.rating.toFixed(1)} rating</span>
                    <span>Updated {formatDate(freelancer.updatedAt)}</span>
                  </div>
                  {freelancer.description && <p className={styles.description}>{freelancer.description}</p>}
                  {freelancer.skills.length > 0 && (
                    <div className={styles.skills}>{freelancer.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
                  )}
                  {freelancer.profileUrl && (
                    <div className={styles.profileLink}><a href={freelancer.profileUrl} target="_blank" rel="noreferrer">Open portfolio / profile ↗</a></div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
