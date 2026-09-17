'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { JobRecord } from '@/lib/jobs';
import styles from './payment-gate.module.css';

type Role = 'CLIENT' | 'FREELANCER';
type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'FAILED' | 'PAID' | 'REFUNDED';
type PaymentSession = {
  finalAmount: number;
  clientFee: number;
  freelancerFee: number;
  clientFeePercent: number;
  freelancerFeePercent: number;
  clientPaymentStatus: PaymentStatus;
  freelancerPaymentStatus: 'PAYOUT_PENDING' | 'PAID' | 'NOT_REQUIRED';
  contactsUnlocked: boolean;
};
type ContactUnlock = {
  client?: { email?: string | null; phone?: string | null };
  freelancer?: { email?: string | null; phone?: string | null };
};

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on?: (event: string, callback: () => void) => void }; } }

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Could not load Razorpay Checkout.')), { once: true }); return; }
    const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true; script.dataset.razorpayCheckout = 'true'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Could not load Razorpay Checkout.')); document.body.appendChild(script);
  });
}
function feeFromPercent(amount: number, percent: number) { return Math.max(1, Math.round(amount * percent / 100)); }

export default function PaymentGate({ job, role }: { job: JobRecord; role: Role }) {
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [feeConfig, setFeeConfig] = useState({ clientFeePercent: 5, freelancerFeePercent: 10 });
  const [contacts, setContacts] = useState<ContactUnlock | null>(null);
  const [phone, setPhone] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'paymentSessions', job.id), (snapshot) => { setSession(snapshot.exists() ? (snapshot.data() as PaymentSession) : null); setError(''); }, () => setError('We could not read payment status.'));
    return unsubscribe;
  }, [job.id]);

  useEffect(() => {
    const user = auth.currentUser; if (!user) return;
    let active = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(`/api/payments/session?jobId=${encodeURIComponent(job.id)}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
        const data = await response.json() as { clientFeePercent?: number; freelancerFeePercent?: number; session?: PaymentSession | null };
        if (!response.ok || !active) return;
        setFeeConfig({ clientFeePercent: Number(data.clientFeePercent ?? 5), freelancerFeePercent: Number(data.freelancerFeePercent ?? 10) });
        if (data.session) setSession(data.session);
      } catch { /* existing Firestore subscription remains useful */ }
    })();
    return () => { active = false; };
  }, [job.id]);

  useEffect(() => {
    if (!session?.contactsUnlocked) { setContacts(null); return; }
    return onSnapshot(doc(db, 'contactUnlocks', job.id), (snapshot) => { setContacts(snapshot.exists() ? (snapshot.data() as ContactUnlock) : null); }, () => setError('Contacts were unlocked, but could not be loaded.'));
  }, [job.id, session?.contactsUnlocked]);

  const finalAmount = session?.finalAmount ?? job.budget;
  const clientFeePercent = session?.clientFeePercent ?? feeConfig.clientFeePercent;
  const freelancerFeePercent = session?.freelancerFeePercent ?? feeConfig.freelancerFeePercent;
  const clientFee = session?.clientFee ?? feeFromPercent(finalAmount, clientFeePercent);
  const freelancerFee = session?.freelancerFee ?? feeFromPercent(finalAmount, freelancerFeePercent);
  const freelancerReceives = Math.max(0, finalAmount - freelancerFee);
  const clientStatus = session?.clientPaymentStatus ?? 'PENDING';
  const clientPaid = clientStatus === 'PAID';
  const unlocked = Boolean(session?.contactsUnlocked && contacts);
  const canPay = role === 'CLIENT' && !clientPaid && clientStatus !== 'REFUNDED';

  async function payClientFee() {
    const user = auth.currentUser;
    if (!user || role !== 'CLIENT') { setError(role === 'FREELANCER' ? 'Freelancers do not pay an upfront platform fee.' : 'Sign in is required to pay.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await loadRazorpay();
      const idToken = await user.getIdToken(true);
      const orderResponse = await fetch('/api/payments/create-order', { method: 'POST', headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ jobId: job.id, phone }) });
      const orderData = await orderResponse.json() as { error?: string; alreadyPaid?: boolean; orderId?: string; amount?: number; currency?: string; keyId?: string };
      if (!orderResponse.ok) throw new Error(orderData.error ?? 'Could not create payment order.');
      if (orderData.alreadyPaid) { setMessage(`Your ${clientFeePercent}% platform fee is already verified.`); return; }
      if (!orderData.orderId || !orderData.keyId) throw new Error('Razorpay Live order details are incomplete.');
      if (!orderData.keyId.startsWith('rzp_live_')) throw new Error('Razorpay Live Mode is required for payments.');
      await new Promise<void>((resolve, reject) => {
        const checkout = new window.Razorpay!({ key: orderData.keyId, amount: orderData.amount, currency: orderData.currency ?? 'INR', name: 'NowMyWork', description: `NowMyWork platform fee · ${job.title}`, order_id: orderData.orderId, prefill: { name: user.displayName ?? '', email: user.email ?? '', contact: phone }, notes: { nowmywork_job_id: job.id, nowmywork_side: 'CLIENT', final_project_amount: String(finalAmount) }, theme: { color: '#111111' }, handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyToken = await user.getIdToken(true);
            const verifyResponse = await fetch('/api/payments/verify', { method: 'POST', headers: { authorization: `Bearer ${verifyToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ jobId: job.id, razorpayOrderId: response.razorpay_order_id, razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature }) });
            const result = await verifyResponse.json() as { error?: string; contactsUnlocked?: boolean };
            if (!verifyResponse.ok) throw new Error(result.error ?? 'Payment verification failed.');
            setMessage(result.contactsUnlocked ? 'Payment verified. Direct contact details are now unlocked.' : 'Payment verified. Contact details will unlock when participant details are available.'); resolve();
          } catch (verificationError) { reject(verificationError); }
        } });
        checkout.open(); checkout.on?.('payment.failed', () => reject(new Error('Payment failed or was cancelled.')));
      });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Payment could not be completed.'); }
    finally { setBusy(false); }
  }

  return <section className={styles.section}>
    <div className={styles.header}><div><div className="eyebrow muted">PAYMENT & CONTACTS</div><h2>Keep the deal on NowMyWork.</h2><p>Clients pay the configured platform fee upfront. Freelancers do not pay upfront; their configured platform fee is part of the settlement calculation.</p></div><div className={styles.amount}>₹{finalAmount.toLocaleString('en-IN')}<span>project value</span></div></div>
    {message && <div className={styles.success} role="status">{message}</div>}{error && <div className={styles.error} role="alert">{error}</div>}

    {role === 'CLIENT' ? <div className={styles.grid}>
      <article className={styles.card}><span className={styles.label}>YOUR FEE</span><strong>{clientFeePercent}% platform fee · paid upfront</strong><div className={styles.fee}>₹{clientFee.toLocaleString('en-IN')}</div><span className={clientPaid ? styles.paid : styles.pending}>{clientPaid ? 'Verified' : clientStatus === 'FAILED' ? 'Payment failed' : clientStatus === 'AUTHORIZED' ? 'Authorised · awaiting capture' : clientStatus === 'REFUNDED' ? 'Refunded' : 'Pending'}</span></article>
      <article className={styles.card}><span className={styles.label}>PROJECT VALUE</span><strong>Amount allocated to the project</strong><div className={styles.fee}>₹{finalAmount.toLocaleString('en-IN')}</div></article>
    </div> : <div className={styles.grid}>
      <article className={styles.card}><span className={styles.label}>CLIENT PAYMENT</span><strong>Client platform fee</strong><div className={styles.fee}>{clientPaid ? 'Verified' : 'Pending'}</div></article>
      <article className={styles.card}><span className={styles.label}>SETTLEMENT ESTIMATE</span><strong>Project value after {freelancerFeePercent}% platform fee</strong><div className={styles.fee}>₹{freelancerReceives.toLocaleString('en-IN')}</div><span>Estimated amount after the platform fee; this checkout does not itself transfer a freelancer payout.</span></article>
    </div>}

    {!unlocked ? <div className={styles.payBox}><div>{role === 'CLIENT' ? <><strong>{clientPaid ? `Your ${clientFeePercent}% fee is verified.` : clientStatus === 'REFUNDED' ? 'This platform fee was refunded.' : `Pay your ${clientFeePercent}% fee · ₹${clientFee.toLocaleString('en-IN')}`}</strong><span>{clientPaid ? 'The upfront platform-fee step is complete.' : clientStatus === 'REFUNDED' ? 'A refunded payment is not automatically charged again. Contact support before making another payment.' : 'Secure payment through Razorpay. NowMyWork verifies the payment on the server before unlocking contact details.'}</span></> : <><strong>{clientPaid ? 'Client payment verified.' : 'Waiting for client payment.'}</strong><span>You pay ₹0 upfront. Once the client fee is verified, direct contact details can unlock for the project participants.</span></>}</div>{canPay && <div className={styles.payActions}><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Mobile number (optional)" aria-label="Mobile number"/><button type="button" className="primary-btn" disabled={busy} onClick={() => void payClientFee()}>{busy ? 'Opening secure payment…' : `Pay ₹${clientFee.toLocaleString('en-IN')} →`}</button></div>}</div> : <div className={styles.unlockBox}><div><span className={styles.label}>CONTACTS UNLOCKED</span><h3>Client payment verified.</h3><p>The client has completed the upfront fee, so both sides can now contact each other directly for this project.</p></div><div className={styles.contacts}><div><span>CLIENT</span><strong>{contacts?.client?.email || 'Email not available'}</strong>{contacts?.client?.phone && <small>{contacts.client.phone}</small>}</div><div><span>FREELANCER</span><strong>{contacts?.freelancer?.email || 'Email not available'}</strong>{contacts?.freelancer?.phone && <small>{contacts.freelancer.phone}</small>}</div></div></div>}
  </section>;
}
