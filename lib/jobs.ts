import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type JobPriority = 'QUALITY' | 'BALANCED' | 'SPEED_BUDGET';
export type JobStatus = 'OPEN' | 'MATCHING' | 'OFFERED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type JobRecord = {
  id: string;
  clientId: string;
  title: string;
  description: string;
  budget: number;
  currency: string;
  durationDays: number;
  skills: string[];
  techStack: string[];
  priority: JobPriority;
  status: JobStatus;
  createdAt?: Timestamp;
};

export type CreateJobInput = Omit<JobRecord, 'id' | 'createdAt' | 'status' | 'currency'>;

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);

export function parseList(value: string) {
  return splitList(value);
}

export async function createJob(input: CreateJobInput) {
  const ref = await addDoc(collection(db, 'jobs'), {
    ...input,
    currency: 'INR',
    status: 'OPEN',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function getClientJobs(clientId: string): Promise<JobRecord[]> {
  const snapshot = await getDocs(query(collection(db, 'jobs'), where('clientId', '==', clientId)));

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as JobRecord)
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}
