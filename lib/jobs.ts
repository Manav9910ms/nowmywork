import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, type Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { JobStatus } from './job-state';

export type JobPriority = 'QUALITY' | 'BALANCED' | 'SPEED_BUDGET';
export type { JobStatus } from './job-state';

export type JobRecord = {
  id: string;
  clientId: string;
  assignedToId?: string;
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
  updatedAt?: Timestamp;
};

export type CreateJobInput = Omit<JobRecord, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'currency'>;

const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean).filter((item, index, items) => items.indexOf(item) === index);
export function parseList(value: string) { return splitList(value); }

export async function createJob(input: CreateJobInput) {
  const ref = await addDoc(collection(db, 'jobs'), { ...input, currency: 'INR', status: 'OPEN', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  const snapshot = await getDoc(doc(db, 'jobs', jobId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as JobRecord) : null;
}

/** @deprecated Project status mutations now go through /api/projects/[jobId]/status. */
export async function updateJobStatus(jobId: string, status: JobStatus) {
  await updateDoc(doc(db, 'jobs', jobId), { status, updatedAt: serverTimestamp() });
}

export async function getClientJobs(clientId: string): Promise<JobRecord[]> {
  const snapshot = await getDocs(query(collection(db, 'jobs'), where('clientId', '==', clientId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as JobRecord).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}
