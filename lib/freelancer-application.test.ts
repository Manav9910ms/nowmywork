import { describe, expect, it } from 'vitest';
import { freelancerApplicationSchema } from './validation';

const validApplication = {
  name: 'Manav Singh',
  email: 'manav@example.com',
  mobileNumber: '+91 98765 43210',
  dateOfBirth: '1998-06-30',
  profileUrl: '',
  description: 'I build responsive business websites and web applications from design through deployment.',
  skills: ['HTML', 'CSS', 'JavaScript'],
  roleTitle: 'Website developer',
  projectLinks: ['https://github.com/example/project'],
  experience: 2,
};

describe('freelancer application validation', () => {
  it('accepts a complete application with optional profile URL', () => {
    const result = freelancerApplicationSchema.safeParse({
      ...validApplication,
      profileUrl: '',
      projectLinks: [],
    });
    expect(result.success).toBe(true);
  });

  it('requires a valid account email and mobile number', () => {
    expect(freelancerApplicationSchema.safeParse({
      ...validApplication,
      email: 'not-an-email',
    }).success).toBe(false);
    expect(freelancerApplicationSchema.safeParse({
      ...validApplication,
      mobileNumber: 'abc',
    }).success).toBe(false);
  });

  it('requires a valid date of birth in the past', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(freelancerApplicationSchema.safeParse({
      ...validApplication,
      dateOfBirth: today,
    }).success).toBe(false);
    expect(freelancerApplicationSchema.safeParse({
      ...validApplication,
      dateOfBirth: '2099-01-01',
    }).success).toBe(false);
  });

  it('requires a professional role, description, and at least one skill', () => {
    expect(freelancerApplicationSchema.safeParse({
      ...validApplication,
      roleTitle: '',
    }).success).toBe(false);
    expect(freelancerApplicationSchema.safeParse({
      ...validApplication,
      description: 'Too short',
    }).success).toBe(false);
    expect(freelancerApplicationSchema.safeParse({
      ...validApplication,
      skills: [],
    }).success).toBe(false);
  });

  it('accepts only valid optional project links and caps them at ten', () => {
    expect(freelancerApplicationSchema.safeParse({
      ...validApplication,
      projectLinks: ['not-a-url'],
    }).success).toBe(false);
    expect(freelancerApplicationSchema.safeParse({
      ...validApplication,
      projectLinks: Array.from({ length: 11 }, (_, index) => `https://example.com/work/${index}`),
    }).success).toBe(false);
  });
});
