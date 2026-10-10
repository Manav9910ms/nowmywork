import { z } from 'zod';

export const prioritySchema = z.enum(['QUALITY', 'BALANCED', 'SPEED_BUDGET']);

const listSchema = z.array(z.string().trim().min(1)).max(30);
const futureDate = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
};

export const createJobSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(8000),
  budget: z.number().int().positive().max(10_000_000),
  durationDays: z.number().int().positive().max(3650),
  skills: listSchema.min(1),
  techStack: listSchema,
  priority: prioritySchema,
  deadline: z.string().datetime().refine(futureDate, 'Deadline must be in the future.').optional().nullable(),
});

export const freelancerProfileSchema = z.object({
  bio: z.string().trim().max(3000),
  hourlyRate: z.number().nonnegative().max(1_000_000).nullable(),
  experience: z.number().int().nonnegative().max(50),
  skills: listSchema.min(1),
  techStack: listSchema,
  portfolioUrl: z.string().url().max(500).or(z.literal('')),
  availability: z.enum(['AVAILABLE', 'AWAY', 'BUSY']),
});


const pastDate = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value < new Date().toISOString().slice(0, 10);
};

const linkSchema = z.string().trim().url().max(500);

export const freelancerApplicationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  mobileNumber: z.string().trim().min(7).max(24).regex(/^\+?[\d\s().-]{7,24}$/, 'Enter a valid mobile number.'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(pastDate, 'Enter a valid date of birth in the past.'),
  profileUrl: z.union([z.string().trim().url().max(500), z.literal('')]).optional().default(''),
  description: z.string().trim().min(20).max(3000),
  skills: listSchema.min(1),
  roleTitle: z.string().trim().min(2).max(100),
  projectLinks: z.array(linkSchema).max(10),
  experience: z.number().min(0).max(50),
});
