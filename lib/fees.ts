function percentEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : fallback;
}

export function clientFeePercent() { return percentEnv('CLIENT_FEE_PERCENT', 5); }
export function freelancerFeePercent() { return percentEnv('FREELANCER_FEE_PERCENT', 10); }
export function calculateFee(amount: number, percent: number) { return Math.max(1, Math.round(amount * percent / 100)); }
