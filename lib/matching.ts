export type ClientPriority = 'QUALITY' | 'BALANCED' | 'SPEED_BUDGET';

export type FreelancerCandidate = {
  id: string;
  skills: string[];
  techStack: string[];
  rating: number;
  completedJobs: number;
  availability: 'AVAILABLE' | 'BUSY' | 'AWAY';
  hourlyRate?: number | null;
  experience?: number | null;
};

export type JobForMatching = {
  skills: string[];
  techStack: string[];
  budget: number;
  durationDays: number;
  priority: ClientPriority;
};

export type ScoredCandidate = FreelancerCandidate & {
  score: number;
};

const normalize = (values: string[]) =>
  new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));

const overlapScore = (required: Set<string>, actual: Set<string>) => {
  if (required.size === 0) return 0;
  let matched = 0;
  for (const value of required) if (actual.has(value)) matched++;
  return matched / required.size;
};

export function scoreFreelancer(job: JobForMatching, freelancer: FreelancerCandidate): number {
  const skillFit = overlapScore(normalize(job.skills), normalize(freelancer.skills));
  const techFit = overlapScore(normalize(job.techStack), normalize(freelancer.techStack));
  const ratingFit = Math.min(Math.max(freelancer.rating, 0), 5) / 5;
  const experienceFit = Math.min(Math.max(freelancer.experience ?? 0, 0), 10) / 10;
  const reliabilityFit = Math.min(Math.max(freelancer.completedJobs, 0), 20) / 20;
  const availabilityFit = freelancer.availability === 'AVAILABLE' ? 1 : freelancer.availability === 'AWAY' ? 0.35 : 0;

  const budgetFit = freelancer.hourlyRate == null
    ? 0.5
    : freelancer.hourlyRate <= job.budget / Math.max(job.durationDays * 8, 1)
      ? 1
      : 0.25;

  const weights = job.priority === 'QUALITY'
    ? { skill: 0.32, tech: 0.22, rating: 0.18, experience: 0.10, reliability: 0.08, availability: 0.05, budget: 0.05 }
    : job.priority === 'SPEED_BUDGET'
      ? { skill: 0.25, tech: 0.15, rating: 0.08, experience: 0.07, reliability: 0.10, availability: 0.20, budget: 0.15 }
      : { skill: 0.30, tech: 0.20, rating: 0.14, experience: 0.09, reliability: 0.09, availability: 0.10, budget: 0.08 };

  return (
    skillFit * weights.skill +
    techFit * weights.tech +
    ratingFit * weights.rating +
    experienceFit * weights.experience +
    reliabilityFit * weights.reliability +
    availabilityFit * weights.availability +
    budgetFit * weights.budget
  ) * 100;
}

export function selectTopFreelancers(
  job: JobForMatching,
  freelancers: FreelancerCandidate[],
  limit = 10,
): ScoredCandidate[] {
  return freelancers
    .filter((freelancer) => freelancer.availability !== 'BUSY')
    .map((freelancer) => ({ ...freelancer, score: scoreFreelancer(job, freelancer) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
