import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';

export const runtime = 'nodejs';

type RazorpayEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string } };
    order?: { entity?: { id?: string; amount?: number; amount_paid?: number; currency?: string } };
  };
};

function json(message: string, status = 200) { return NextResponse.json({ received: status < 400, message }, { status }); }

function validSignature(raw: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) return json('Webhook secret is not configured.', 500);

  const signature = request.headers.get('x-razorpay-signature')?.trim();
  const eventId = request.headers.get('x-razorpay-event-id')?.trim();
  if (!signature || !eventId) return json('Webhook signature headers are required.', 400);

  const rawBody = await request.text();
  if (!validSignature(rawBody, signature, secret)) return json('Invalid webhook signature.', 400);

  let payload: RazorpayEvent;
  try { payload = JSON.parse(rawBody) as RazorpayEvent; } catch { return json('Invalid webhook payload.', 400); }

  const event = String(payload.event ?? '');
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;
  const orderId = String(payment?.order_id ?? order?.id ?? '');
  if (!orderId) return json('Webhook received without a known order.', 200);

  const db = adminDb();
  const eventDocId = createHash('sha256').update(eventId).digest('hex');
  const eventRef = db.collection('paymentWebhookEvents').doc(eventDocId);
  const sessionQuery = await db.collection('paymentSessions').where('clientOrderId', '==', orderId).limit(1).get();
  if (sessionQuery.empty) return json('Event acknowledged; order is not tracked by NowMyWork.', 200);

  const sessionRef = sessionQuery.docs[0].ref;
  const session = sessionQuery.docs[0].data();
  let clientContact: { email?: string | null; phone?: string | null } = {};
  let freelancerContact: { email?: string | null; phone?: string | null } = {};
  const clientParty = session.clientId ? await db.collection('paymentParties').doc(`${session.jobId}_${session.clientId}`).get() : null;
  const freelancerParty = session.freelancerId ? await db.collection('paymentParties').doc(`${session.jobId}_${session.freelancerId}`).get() : null;
  if (clientParty?.exists) {
    const data = clientParty.data()!;
    clientContact = { email: String(data.email ?? '') || null, phone: String(data.phone ?? '') || null };
  }
  if (freelancerParty?.exists) {
    const data = freelancerParty.data()!;
    freelancerContact = { email: String(data.email ?? '') || null, phone: String(data.phone ?? '') || null };
  }

  const amount = payment?.amount ?? order?.amount_paid ?? order?.amount;
  const currency = payment?.currency ?? order?.currency ?? 'INR';
  const expectedAmount = Number(session.clientFee ?? 0) * 100;
  const paymentId = payment?.id ?? null;
  const now = Timestamp.now();
  const contactsUnlocked = Boolean((clientContact.email || clientContact.phone) && (freelancerContact.email || freelancerContact.phone));

  await db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventRef);
    if (eventSnapshot.exists) return;
    const latestSession = await transaction.get(sessionRef);
    if (!latestSession.exists) {
      transaction.create(eventRef, { eventId, event, orderId, processedAt: now, status: 'SESSION_MISSING' });
      return;
    }

    const latest = latestSession.data()!;
    const currentStatus = String(latest.clientPaymentStatus ?? 'PENDING');
    let nextStatus: string | null = null;
    if (['payment.captured', 'order.paid'].includes(event)) {
      if (typeof amount === 'number' && amount !== expectedAmount) {
        transaction.create(eventRef, { eventId, event, orderId, processedAt: now, status: 'AMOUNT_MISMATCH', receivedAmount: amount, expectedAmount });
        return;
      }
      if (currency !== 'INR') {
        transaction.create(eventRef, { eventId, event, orderId, processedAt: now, status: 'CURRENCY_MISMATCH', receivedCurrency: currency });
        return;
      }
      nextStatus = 'PAID';
    } else if (event === 'payment.authorized') {
      if (currentStatus === 'PENDING') nextStatus = 'AUTHORIZED';
    } else if (event === 'payment.failed') {
      if (!['PAID', 'REFUNDED'].includes(currentStatus)) nextStatus = 'FAILED';
    } else if (['payment.refunded', 'payment.partially_refunded'].includes(event)) {
      nextStatus = 'REFUNDED';
    }

    if (!nextStatus) {
      transaction.create(eventRef, { eventId, event, orderId, processedAt: now, status: 'IGNORED' });
      return;
    }
    if (currentStatus === 'REFUNDED' && nextStatus !== 'REFUNDED') {
      transaction.create(eventRef, { eventId, event, orderId, processedAt: now, status: 'IGNORED_TERMINAL_STATE' });
      return;
    }

    const update: Record<string, unknown> = { clientPaymentStatus: nextStatus, updatedAt: now };
    if (paymentId) update.clientPaymentId = paymentId;
    if (nextStatus === 'PAID') update.contactsUnlocked = contactsUnlocked;
    transaction.update(sessionRef, update);

    if (nextStatus === 'PAID' && contactsUnlocked) {
      transaction.set(db.collection('contactUnlocks').doc(String(session.jobId)), {
        jobId: session.jobId,
        client: clientContact,
        freelancer: freelancerContact,
        unlockedAt: now,
      }, { merge: true });
    }

    transaction.create(eventRef, { eventId, event, orderId, processedAt: now, status: nextStatus, paymentId });
  });

  return json('Webhook processed.', 200);
}
