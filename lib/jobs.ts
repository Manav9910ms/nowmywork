import { collection, doc, getDoc, getDocs, query, where, type Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { JobStatus } from './job-state';

export type JobPriority = 'QUALITY' | 'BALANCED' | 'SPEED_BUDGET';
export type { JobStatus } from './job-state';

export type JobRecord = {
  id: string;
  clientId: string;
  assignedToId?: string;
  assignedToName?: string;
  title: string;
  description: string;
  budget: number;
  currency: string;
  durationDays: number;
  deadline?: string | null;
  skills: string[];
  techStack: string[];
  priority: JobPriority;
  status: JobStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const splitList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean).filter((item, index, items) => items.indexOf(item) === index);
export function parseList(value: string) { return splitList(value); }

export async function getJob(jobId: string): Promise<JobRecord | null> {
  const snapshot = await getDoc(doc(db, 'jobs', jobId));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as JobRecord) : null;
}

export async function getClientJobs(clientId: string): Promise<JobRecord[]> {
  const snapshot = await getDocs(query(collection(db, 'jobs'), where('clientId', '==', clientId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as JobRecord).sort((a, b) => (b.updatedAt?.toMillis() ?? b.createdAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? a.createdAt?.toMillis() ?? 0));
}
