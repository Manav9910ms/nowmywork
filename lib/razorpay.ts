function requiredLiveKeyId() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  if (!keyId) throw new Error('Razorpay Live credentials are not configured on the server.');
  if (!keyId.startsWith('rzp_live_')) {
    throw new Error('Razorpay Live Mode key is required. Test Mode keys are not accepted.');
  }
  return keyId;
}

export function getLiveRazorpayCredentials() {
  const keyId = requiredLiveKeyId();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keySecret) throw new Error('Razorpay Live credentials are not configured on the server.');
  return { keyId, keySecret };
}
