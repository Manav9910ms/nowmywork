import {
  browserLocalPersistence,
  GoogleAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const googleProvider = new GoogleAuthProvider();
export type AccountRole = 'CLIENT' | 'FREELANCER';

export async function prepareAuth() { await setPersistence(auth, browserLocalPersistence); }
export async function signUpWithEmail(email: string, password: string, displayName: string) { await prepareAuth(); const credential = await createUserWithEmailAndPassword(auth, email, password); if (displayName.trim()) await updateProfile(credential.user, { displayName: displayName.trim() }); await sendEmailVerification(credential.user); return credential.user; }
export async function signInWithEmail(email: string, password: string) { await prepareAuth(); return (await signInWithEmailAndPassword(auth, email, password)).user; }
export async function signInWithGoogle() { await prepareAuth(); return (await signInWithPopup(auth, googleProvider)).user; }
export async function resetPassword(email: string) { await sendPasswordResetEmail(auth, email.trim()); }
export async function logOut() { await signOut(auth); }

export async function syncAccount(user: User, role?: AccountRole) {
  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);
  const existingRole = existing.exists() ? (existing.data().role as AccountRole | undefined) : undefined;
  const resolvedRole: AccountRole = existingRole ?? role ?? 'CLIENT';
  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || 'NowMyWork User';
  const userData = { uid: user.uid, email: user.email?.trim().toLowerCase() ?? '', name: displayName, role: resolvedRole, updatedAt: serverTimestamp(), ...(existing.exists() ? {} : { createdAt: serverTimestamp() }) };
  await setDoc(userRef, userData, { merge: true });
  window.localStorage.setItem('nowmywork_role', resolvedRole);
  return { user: { id: user.uid, firebaseUid: user.uid, email: userData.email, name: userData.name, role: resolvedRole } };
}
