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
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const googleProvider = new GoogleAuthProvider();

export type AccountRole = 'CLIENT' | 'FREELANCER';

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

export async function syncAccount(user: User, role?: AccountRole) {
  const userRef = doc(db, 'users', user.uid);
  const existing = await getDoc(userRef);
  const existingRole = existing.exists() ? (existing.data().role as AccountRole | undefined) : undefined;
  const resolvedRole: AccountRole = existingRole ?? role ?? 'CLIENT';

  const userData = {
    uid: user.uid,
    email: user.email?.trim().toLowerCase() ?? '',
    name: user.displayName?.trim() || user.email?.split('@')[0] || 'NowMyWork User',
    role: resolvedRole,
    updatedAt: serverTimestamp(),
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
  };

  await setDoc(userRef, userData, { merge: true });

  if (resolvedRole === 'FREELANCER') {
    await setDoc(
      doc(db, 'freelancers', user.uid),
      {
        userId: user.uid,
        bio: '',
        hourlyRate: null,
        experience: 0,
        rating: 0,
        completedJobs: 0,
        availability: 'AVAILABLE',
        skills: [],
        techStack: [],
        portfolioUrl: '',
        updatedAt: serverTimestamp(),
        ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
  }

  window.localStorage.setItem('nowmywork_role', resolvedRole);

  return {
    user: {
      id: user.uid,
      firebaseUid: user.uid,
      email: userData.email,
      name: userData.name,
      role: resolvedRole,
    },
  };
}
