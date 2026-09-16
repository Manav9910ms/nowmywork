import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition } from './job-state';

describe('job state machine', () => {
  it('allows normal work progression', () => {
    expect(canTransition('ASSIGNED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'SUBMITTED')).toBe(true);
    expect(canTransition('SUBMITTED', 'COMPLETED')).toBe(true);
  });
  it('blocks arbitrary transitions', () => {
    expect(canTransition('OPEN', 'COMPLETED')).toBe(false);
    expect(() => assertTransition('OPEN', 'COMPLETED')).toThrow('INVALID_JOB_TRANSITION');
  });
});
