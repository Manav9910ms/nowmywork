import {
  browserLocalPersistence,
  GoogleAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();

export async function prepareAuth() {
  await setPersistence(auth, browserLocalPersistence);
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  await prepareAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  await sendEmailVerification(credential.user);
  return credential.user;
}

export async function signInWithEmail(email: string, password: string) {
  await prepareAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signInWithGoogle() {
  await prepareAuth();
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function logOut() {
  await signOut(auth);
}

export async function syncAccount(user: User, role?: 'CLIENT' | 'FREELANCER') {
  const idToken = await user.getIdToken();
  const response = await fetch('/api/auth/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(role ? { role } : {}),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? 'Unable to sync your account.');
  }

  return (await response.json()) as {
    user: { id: string; firebaseUid: string; email: string; name: string; role: 'CLIENT' | 'FREELANCER' | 'ADMIN' };
  };
}
