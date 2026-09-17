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
  completionRate?: number | null;
  cancellationRate?: number | null;
  responseRate?: number | null;
};

export type JobForMatching = {
  skills: string[];
  techStack: string[];
  budget: number;
  durationDays: number;
  priority: ClientPriority;
};

export type MatchReason = { key: string; label: string; score: number };
export type ScoredCandidate = FreelancerCandidate & { score: number; reasons: MatchReason[] };

const normalize = (values: string[]) => new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));

const overlapScore = (required: Set<string>, actual: Set<string>) => {
  if (required.size === 0) return 1;
  let matched = 0;
  for (const value of required) if (actual.has(value)) matched += 1;
  return matched / required.size;
};

function getWeights(priority: ClientPriority) {
  if (priority === 'QUALITY') return { skill: 0.32, tech: 0.20, rating: 0.15, experience: 0.10, reliability: 0.10, availability: 0.04, budget: 0.04, response: 0.05 };
  if (priority === 'SPEED_BUDGET') return { skill: 0.25, tech: 0.12, rating: 0.06, experience: 0.06, reliability: 0.08, availability: 0.18, budget: 0.15, response: 0.10 };
  return { skill: 0.30, tech: 0.18, rating: 0.12, experience: 0.09, reliability: 0.10, availability: 0.08, budget: 0.07, response: 0.06 };
}

export function eligibleForJob(job: JobForMatching, freelancer: FreelancerCandidate) {
  const requiredSkills = normalize(job.skills);
  const freelancerSkills = normalize(freelancer.skills);
  return freelancer.availability !== 'BUSY' && overlapScore(requiredSkills, freelancerSkills) >= 1;
}

export function scoreFreelancer(job: JobForMatching, freelancer: FreelancerCandidate) {
  return scoreFreelancerDetailed(job, freelancer).score;
}

export function scoreFreelancerDetailed(job: JobForMatching, freelancer: FreelancerCandidate): ScoredCandidate {
  const skillFit = overlapScore(normalize(job.skills), normalize(freelancer.skills));
  const techFit = overlapScore(normalize(job.techStack), normalize(freelancer.techStack));
  const ratingFit = Math.min(Math.max(freelancer.rating ?? 0, 0), 5) / 5;
  const experienceFit = Math.min(Math.max(freelancer.experience ?? 0, 0), 10) / 10;
  const completionFit = freelancer.completionRate == null ? 0.5 : Math.min(Math.max(freelancer.completionRate, 0), 100) / 100;
  const cancellationFit = freelancer.cancellationRate == null ? 0.5 : 1 - Math.min(Math.max(freelancer.cancellationRate, 0), 100) / 100;
  const reliabilityFit = completionFit * 0.8 + cancellationFit * 0.2;
  const availabilityFit = freelancer.availability === 'AVAILABLE' ? 1 : freelancer.availability === 'AWAY' ? 0.35 : 0;
  const responseFit = freelancer.responseRate == null ? 0.5 : Math.min(Math.max(freelancer.responseRate, 0), 100) / 100;
  const targetHourly = job.budget / Math.max(job.durationDays * 8, 1);
  const budgetFit = freelancer.hourlyRate == null ? 0.5 : freelancer.hourlyRate <= targetHourly ? 1 : Math.max(0.1, targetHourly / freelancer.hourlyRate);
  const weights = getWeights(job.priority);

  const raw = skillFit * weights.skill + techFit * weights.tech + ratingFit * weights.rating + experienceFit * weights.experience + reliabilityFit * weights.reliability + availabilityFit * weights.availability + budgetFit * weights.budget + responseFit * weights.response;
  const reasons: MatchReason[] = [
    { key: 'skills', label: `${Math.round(skillFit * 100)}% required-skill match`, score: skillFit },
    { key: 'tech', label: techFit > 0 ? `${Math.round(techFit * 100)}% tech-stack match` : 'No listed tech-stack overlap', score: techFit },
    { key: 'availability', label: freelancer.availability === 'AVAILABLE' ? 'Available now' : 'Limited availability', score: availabilityFit },
    { key: 'experience', label: `${freelancer.experience ?? 0} years experience`, score: experienceFit },
    { key: 'budget', label: freelancer.hourlyRate == null ? 'Rate not set' : budgetFit >= 0.9 ? 'Budget compatible' : 'Above target rate', score: budgetFit },
    { key: 'reliability', label: `${Math.round(reliabilityFit * 100)}% reliability signal`, score: reliabilityFit },
  ].filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

  return { ...freelancer, score: Math.max(0, Math.min(100, raw * 100)), reasons };
}

export function selectTopFreelancers(job: JobForMatching, freelancers: FreelancerCandidate[], limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  return freelancers
    .filter((freelancer) => eligibleForJob(job, freelancer))
    .map((freelancer) => scoreFreelancerDetailed(job, freelancer))
    .sort((a, b) => b.score - a.score || b.completedJobs - a.completedJobs || a.id.localeCompare(b.id))
    .slice(0, safeLimit);
}

export const DEFAULT_MATCH_CANDIDATE_LIMIT = 10;
