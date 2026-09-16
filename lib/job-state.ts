export type JobStatus = 'DRAFT' | 'OPEN' | 'MATCHING' | 'OFFERED' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

const transitions: Record<JobStatus, readonly JobStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['MATCHING', 'OFFERED', 'CANCELLED'],
  MATCHING: ['OPEN', 'OFFERED', 'CANCELLED'],
  OFFERED: ['OPEN', 'ASSIGNED', 'MATCHING', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED', 'DISPUTED'],
  IN_PROGRESS: ['SUBMITTED', 'CANCELLED', 'DISPUTED'],
  SUBMITTED: ['COMPLETED', 'IN_PROGRESS', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
};

export function canTransition(from: JobStatus, to: JobStatus) {
  return transitions[from]?.includes(to) ?? false;
}

export function assertTransition(from: JobStatus, to: JobStatus) {
  if (!canTransition(from, to)) throw new Error('INVALID_JOB_TRANSITION');
}

export function allowedTransitions(from: JobStatus) {
  return transitions[from] ?? [];
}
