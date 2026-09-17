import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isBrowser = typeof window !== 'undefined';
const hasClientConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.trim().length > 0,
);

// Next.js prerenders client components during production builds. Firebase Auth
// must only be initialized in the browser so a missing browser-only API key
// cannot abort the entire build. Production browser usage still requires the
// real NEXT_PUBLIC_FIREBASE_* values to be configured in Vercel before build.
const app: FirebaseApp | null = isBrowser && hasClientConfig
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseApp = app;

// Server-rendered client components only need a harmless placeholder. Their
// Firebase effects run after hydration in the browser, where the real Auth and
// Firestore instances are created above when configuration is present.
export const auth: Auth = app
  ? getAuth(app)
  : ({ currentUser: null } as unknown as Auth);

export const db: Firestore = app
  ? getFirestore(app)
  : ({} as Firestore);
