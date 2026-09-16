import { z } from 'zod';

export const prioritySchema = z.enum(['QUALITY', 'BALANCED', 'SPEED_BUDGET']);

const listSchema = z.array(z.string().trim().min(1)).max(30);

export const createJobSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(8000),
  budget: z.number().int().positive().max(10_000_000),
  durationDays: z.number().int().positive().max(3650),
  skills: listSchema.min(1),
  techStack: listSchema,
  priority: prioritySchema,
  deadline: z.string().datetime().optional().nullable(),
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
