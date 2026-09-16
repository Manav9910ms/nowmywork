import { describe, expect, it } from 'vitest';
import { eligibleForJob, selectTopFreelancers, scoreFreelancer } from './matching';

const job = {
  skills: ['React', 'TypeScript'],
  techStack: ['Next.js'],
  budget: 20000,
  durationDays: 7,
  priority: 'BALANCED' as const,
};

const freelancer = (overrides: Partial<Parameters<typeof eligibleForJob>[1]> = {}) => ({
  id: 'f1', skills: ['React', 'TypeScript'], techStack: ['Next.js'], rating: 4.8, completedJobs: 20,
  availability: 'AVAILABLE' as const, hourlyRate: 250, experience: 5, ...overrides,
});

describe('NowMyWork matching', () => {
  it('accepts an exact required-skill match', () => expect(eligibleForJob(job, freelancer())).toBe(true));
  it('rejects a freelancer missing any mandatory skill', () => expect(eligibleForJob(job, freelancer({ skills: ['React'] }))).toBe(false));
  it('rejects busy freelancers', () => expect(eligibleForJob(job, freelancer({ availability: 'BUSY' }))).toBe(false));
  it('returns a normalized score between 0 and 100', () => {
    const score = scoreFreelancer(job, freelancer());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
  it('prioritizes available and budget-compatible candidates for speed/budget mode', () => {
    const speedJob = { ...job, priority: 'SPEED_BUDGET' as const };
    const fast = freelancer({ id: 'fast', availability: 'AVAILABLE', hourlyRate: 200 });
    const slower = freelancer({ id: 'slower', availability: 'AWAY', hourlyRate: 100 });
    expect(scoreFreelancer(speedJob, fast)).toBeGreaterThan(scoreFreelancer(speedJob, slower));
  });
  it('limits selected candidates to the requested top N', () => {
    const freelancers = Array.from({ length: 15 }, (_, index) => freelancer({ id: `f${index}` }));
    expect(selectTopFreelancers(job, freelancers, 10)).toHaveLength(10);
  });
});
