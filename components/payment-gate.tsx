'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { JobRecord } from '@/lib/jobs';
import styles from './payment-gate.module.css';

type Role = 'CLIENT' | 'FREELANCER';

type PaymentSession = {
  finalAmount: number;
  clientFee: number;
  freelancerFee: number;
  clientPaymentStatus: 'PENDING' | 'PAID';
  freelancerPaymentStatus: 'PENDING' | 'PAID';
  contactsUnlocked: boolean;
};

type ContactUnlock = {
  client?: { email?: string | null; phone?: string | null };
  freelancer?: { email?: string | null; phone?: string | null };
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay Checkout.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout.'));
    document.body.appendChild(script);
  });
}

export default function PaymentGate({ job, role }: { job: JobRecord; role: Role }) {
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [contacts, setContacts] = useState<ContactUnlock | null>(null);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionRef = doc(db, 'paymentSessions', job.id);
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      setSession(snapshot.exists() ? (snapshot.data() as PaymentSession) : null);
    }, () => {
      setError('We could not read payment status.');
    });
    return unsubscribe;
  }, [job.id]);

  useEffect(() => {
    if (!session?.contactsUnlocked) {
      setContacts(null);
      return;
    }
    return onSnapshot(doc(db, 'contactUnlocks', job.id), (snapshot) => {
      setContacts(snapshot.exists() ? (snapshot.data() as ContactUnlock) : null);
    }, () => setError('Contacts were unlocked, but could not be loaded.'));
  }, [job.id, session?.contactsUnlocked]);

  const finalAmount = session?.finalAmount ?? job.budget;
  const ownFee = role === 'CLIENT' ? session?.clientFee ?? Math.round(job.budget * 0.05) : session?.freelancerFee ?? Math.round(job.budget * 0.05);
  const ownPaid = role === 'CLIENT' ? session?.clientPaymentStatus === 'PAID' : session?.freelancerPaymentStatus === 'PAID';
  const otherPaid = role === 'CLIENT' ? session?.freelancerPaymentStatus === 'PAID' : session?.clientPaymentStatus === 'PAID';
  const unlocked = Boolean(session?.contactsUnlocked && contacts);

  async function payFee() {
    const user = auth.currentUser;
    if (!user) {
      setError('Sign in is required to pay.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await loadRazorpay();
      const idToken = await user.getIdToken();
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, role, phone }),
      });
      const orderData = await orderResponse.json() as { error?: string; alreadyPaid?: boolean; orderId?: string; amount?: number; currency?: string; keyId?: string; fee?: number };
      if (!orderResponse.ok) throw new Error(orderData.error ?? 'Could not create payment order.');
      if (orderData.alreadyPaid) {
        setMessage('Your platform fee is already paid.');
        return;
      }
      if (!orderData.orderId || !orderData.keyId) throw new Error('Razorpay order details are incomplete.');

      await new Promise<void>((resolve, reject) => {
        const checkout = new window.Razorpay!({
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency ?? 'INR',
          name: 'NowMyWork',
          description: `5% platform fee · ${job.title}`,
          order_id: orderData.orderId,
          prefill: { name: user.displayName ?? '', email: user.email ?? '', contact: phone },
          notes: { nowmywork_job_id: job.id, nowmywork_side: role },
          theme: { color: '#111111' },
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              const verifyToken = await user.getIdToken(true);
              const verifyResponse = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { authorization: `Bearer ${verifyToken}`, 'content-type': 'application/json' },
                body: JSON.stringify({
                  jobId: job.id,
                  role,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });
              const result = await verifyResponse.json() as { error?: string; contactsUnlocked?: boolean };
              if (!verifyResponse.ok) throw new Error(result.error ?? 'Payment verification failed.');
              setMessage(result.contactsUnlocked ? 'Both fees are verified. Direct contact details are now unlocked.' : 'Payment verified. Waiting for the other side to complete their 5% fee.');
              resolve();
            } catch (verificationError) {
              reject(verificationError);
            }
          },
        });
        checkout.open();
        (checkout as unknown as { on?: (event: string, callback: () => void) => void }).on?.('payment.failed', () => reject(new Error('Payment failed or was cancelled.')));
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Payment could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className="eyebrow muted">PAYMENT & CONTACTS</div>
          <h2>Keep the deal on NowMyWork.</h2>
          <p>Each side pays a 5% NowMyWork platform fee on the final agreed project amount. Contact details unlock only after both fees are verified.</p>
        </div>
        <div className={styles.amount}>₹{finalAmount.toLocaleString('en-IN')}<span>final project amount</span></div>
      </div>

      {message && <div className={styles.success} role="status">{message}</div>}
      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.grid}>
        <article className={styles.card}>
          <span className={styles.label}>CLIENT</span>
          <strong>{role === 'CLIENT' ? 'Your 5% fee' : 'Client 5% fee'}</strong>
          <div className={styles.fee}>₹{(session?.clientFee ?? Math.round(job.budget * 0.05)).toLocaleString('en-IN')}</div>
          <span className={session?.clientPaymentStatus === 'PAID' ? styles.paid : styles.pending}>{session?.clientPaymentStatus === 'PAID' ? 'Verified' : 'Pending'}</span>
        </article>
        <article className={styles.card}>
          <span className={styles.label}>FREELANCER</span>
          <strong>{role === 'FREELANCER' ? 'Your 5% fee' : 'Freelancer 5% fee'}</strong>
          <div className={styles.fee}>₹{(session?.freelancerFee ?? Math.round(job.budget * 0.05)).toLocaleString('en-IN')}</div>
          <span className={session?.freelancerPaymentStatus === 'PAID' ? styles.paid : styles.pending}>{session?.freelancerPaymentStatus === 'PAID' ? 'Verified' : 'Pending'}</span>
        </article>
      </div>

      {!unlocked ? (
        <div className={styles.payBox}>
          <div>
            <strong>{ownPaid ? 'Your fee is verified.' : `Pay your 5% fee · ₹${ownFee.toLocaleString('en-IN')}`}</strong>
            <span>{otherPaid ? 'The other side has paid. Complete your fee to unlock contacts.' : 'Test mode: Razorpay will simulate the payment. No real money is deducted.'}</span>
          </div>
          {!ownPaid && <div className={styles.payActions}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Mobile number (optional)" aria-label="Mobile number" />
            <button type="button" className="primary-btn" disabled={busy} onClick={() => void payFee()}>{busy ? 'Opening payment…' : `Pay ₹${ownFee.toLocaleString('en-IN')} →`}</button>
          </div>}
        </div>
      ) : (
        <div className={styles.unlockBox}>
          <div>
            <span className={styles.label}>CONTACTS UNLOCKED</span>
            <h3>Both sides are verified.</h3>
            <p>You can now contact each other directly for this project.</p>
          </div>
          <div className={styles.contacts}>
            <div><span>CLIENT</span><strong>{contacts?.client?.email || 'Email not available'}</strong>{contacts?.client?.phone && <small>{contacts.client.phone}</small>}</div>
            <div><span>FREELANCER</span><strong>{contacts?.freelancer?.email || 'Email not available'}</strong>{contacts?.freelancer?.phone && <small>{contacts.freelancer.phone}</small>}</div>
          </div>
        </div>
      )}
    </section>
  );
}
