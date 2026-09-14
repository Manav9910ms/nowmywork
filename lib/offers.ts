import {
  collection,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  doc,
  runTransaction,
  where,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type { JobRecord } from './jobs';
import type { ScoredCandidate } from './matching';

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'SUPERSEDED';

export type JobOffer = {
  id: string;
  jobId: string;
  clientId: string;
  freelancerId: string;
  freelancerName: string;
  score: number;
  status: OfferStatus;
  expiresAt?: Timestamp;
  createdAt?: Timestamp;
  respondedAt?: Timestamp;
  title: string;
  description: string;
  budget: number;
  currency: string;
  durationDays: number;
  skills: string[];
  techStack: string[];
  priority: JobRecord['priority'];
};

const offerIdFor = (jobId: string, freelancerId: string) => `${jobId}_${freelancerId}`;

const asOffer = (id: string, data: DocumentData) => ({ id, ...data }) as JobOffer;

export async function createPrivateOffers(job: JobRecord, candidates: Array<ScoredCandidate & { displayName?: string }>) {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  await Promise.all(
    candidates.map((candidate) =>
      setDoc(doc(db, 'offers', offerIdFor(job.id, candidate.id)), {
        jobId: job.id,
        clientId: job.clientId,
        freelancerId: candidate.id,
        freelancerName: candidate.displayName || 'Freelancer',
        score: candidate.score,
        status: 'PENDING',
        expiresAt,
        createdAt: serverTimestamp(),
        title: job.title,
        description: job.description,
        budget: job.budget,
        currency: job.currency,
        durationDays: job.durationDays,
        skills: job.skills,
        techStack: job.techStack,
        priority: job.priority,
      }, { merge: true }),
    ),
  );

  await updateDoc(doc(db, 'jobs', job.id), {
    status: 'OFFERED',
    updatedAt: serverTimestamp(),
  });
}

export async function getFreelancerOffers(freelancerId: string): Promise<JobOffer[]> {
  const snapshot = await getDocs(query(collection(db, 'offers'), where('freelancerId', '==', freelancerId)));
  return snapshot.docs
    .map((item) => asOffer(item.id, item.data()))
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export async function respondToOffer(offer: JobOffer, response: 'ACCEPTED' | 'DECLINED') {
  if (response === 'DECLINED') {
    await updateDoc(doc(db, 'offers', offer.id), {
      status: 'DECLINED',
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await runTransaction(db, async (transaction) => {
    const offerRef = doc(db, 'offers', offer.id);
    const jobRef = doc(db, 'jobs', offer.jobId);
    const offerSnapshot = await transaction.get(offerRef);
    const jobSnapshot = await transaction.get(jobRef);

    if (!offerSnapshot.exists()) throw new Error('This offer no longer exists.');
    if (!jobSnapshot.exists()) throw new Error('This project no longer exists.');

    const currentOffer = offerSnapshot.data() as JobOffer;
    const currentJob = jobSnapshot.data() as JobRecord;

    if (currentOffer.status !== 'PENDING') throw new Error('This offer is no longer available.');
    if (currentOffer.expiresAt && currentOffer.expiresAt.toMillis() <= Date.now()) {
      throw new Error('This offer has expired.');
    }
    if (!['OPEN', 'OFFERED'].includes(currentJob.status)) {
      throw new Error('This project has already been assigned.');
    }

    transaction.update(offerRef, {
      status: 'ACCEPTED',
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(jobRef, {
      status: 'ASSIGNED',
      assignedToId: offer.freelancerId,
      updatedAt: serverTimestamp(),
    });
  });
}
