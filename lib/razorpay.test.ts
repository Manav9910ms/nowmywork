import { afterEach, describe, expect, it } from 'vitest';
import { getLiveRazorpayCredentials } from './razorpay';

describe('Razorpay Live credentials', () => {
  const originalKey = process.env.RAZORPAY_KEY_ID;
  const originalSecret = process.env.RAZORPAY_KEY_SECRET;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalKey;
    if (originalSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalSecret;
  });

  it('rejects Test Mode key IDs', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_example';
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    expect(() => getLiveRazorpayCredentials()).toThrow('Live Mode key is required');
  });

  it('requires both live key ID and secret', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_live_example';
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(() => getLiveRazorpayCredentials()).toThrow('Live credentials are not configured');
  });

  it('accepts a configured Live credential pair', () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_live_example';
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    expect(getLiveRazorpayCredentials()).toEqual({ keyId: 'rzp_live_example', keySecret: 'secret' });
  });
});
