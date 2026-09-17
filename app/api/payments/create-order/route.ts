import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/admin';
import { calculateFee, clientFeePercent, freelancerFeePercent } from '@/lib/fees';
import { getLiveRazorpayCredentials } from '@/lib/razorpay';
import { requireUser, assertRole, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

type StoredSession = Record<string, unknown>;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isRecentTimestamp(value: unknown, maxAgeMs: number) {
  return value instanceof Timestamp && Date.now() - value.toMillis() < maxAgeMs;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'CLIENT');
    const body = await request.json() as { jobId?: string; phone?: string };
    const jobId = body.jobId?.trim();
    if (!jobId) return jsonError('Project ID is required.');

    const { keyId, keySecret } = getLiveRazorpayCredentials();
    const db = adminDb();
    const jobRef = db.collection('jobs').doc(jobId);
    const sessionRef = db.collection('paymentSessions').doc(jobId);
    const now = Timestamp.now();
    const lockId = randomUUID();

    const state = await db.runTransaction(async (transaction) => {
      const jobSnapshot = await transaction.get(jobRef);
      const sessionSnapshot = await transaction.get(sessionRef);
      if (!jobSnapshot.exists) throw new Error('JOB_NOT_FOUND');
      const job = jobSnapshot.data()!;
      if (job.clientId !== user.uid) throw new Error('FORBIDDEN');
      if (!['ASSIGNED', 'IN_PROGRESS'].includes(String(job.status ?? ''))) throw new Error('JOB_NOT_PAYABLE');

      const current = (sessionSnapshot.data() ?? {}) as StoredSession;
      if (current.clientPaymentStatus === 'PAID') {
        return { kind: 'PAID' as const, fee: Number(current.clientFee ?? 0), contactsUnlocked: Boolean(current.contactsUnlocked) };
      }
      if (typeof current.clientOrderId === 'string' && current.clientOrderId) {
        return { kind: 'ORDER' as const, orderId: current.clientOrderId, fee: Number(current.clientFee ?? 0), finalAmount: Number(current.finalAmount ?? job.budget), freelancerFee: Number(current.freelancerFee ?? 0) };
      }
      if (isRecentTimestamp(current.orderCreationLockedAt, 2 * 60 * 1000)) throw new Error('ORDER_IN_PROGRESS');

      const finalAmount = Number(job.budget ?? 0);
      if (!Number.isFinite(finalAmount) || finalAmount <= 0) throw new Error('INVALID_AMOUNT');
      const clientPercent = clientFeePercent();
      const freelancerPercent = freelancerFeePercent();
      const clientFee = calculateFee(finalAmount, clientPercent);
      const freelancerFee = calculateFee(finalAmount, freelancerPercent);
      const session = {
        jobId,
        clientId: user.uid,
        freelancerId: String(job.assignedToId ?? ''),
        finalAmount,
        clientFee,
        freelancerFee,
        clientFeePercent: clientPercent,
        freelancerFeePercent: freelancerPercent,
        currency: 'INR',
        clientPaymentStatus: current.clientPaymentStatus ?? 'PENDING',
        freelancerPaymentStatus: current.freelancerPaymentStatus ?? 'PAYOUT_PENDING',
        clientPaymentId: current.clientPaymentId ?? null,
        clientOrderId: current.clientOrderId ?? null,
        freelancerPaymentId: current.freelancerPaymentId ?? null,
        freelancerOrderId: current.freelancerOrderId ?? null,
        contactsUnlocked: current.contactsUnlocked ?? false,
        createdAt: current.createdAt ?? now,
        updatedAt: now,
        orderCreationLock: lockId,
        orderCreationLockedAt: now,
      };
      transaction.set(sessionRef, session, { merge: true });
      return { kind: 'CREATE' as const, clientFee, freelancerFee, finalAmount };
    });

    if (state.kind === 'PAID') {
      return NextResponse.json({ alreadyPaid: true, contactsUnlocked: state.contactsUnlocked, fee: state.fee, currency: 'INR' });
    }
    if (state.kind === 'ORDER') {
      return NextResponse.json({ orderId: state.orderId, amount: state.fee * 100, currency: 'INR', keyId, fee: state.fee, finalAmount: state.finalAmount, freelancerFee: state.freelancerFee, clientFeePercent: clientFeePercent(), freelancerFeePercent: freelancerFeePercent() });
    }

    const phone = body.phone?.trim() || user.token.phone_number || null;
    await db.collection('paymentParties').doc(`${jobId}_${user.uid}`).set({
      jobId,
      uid: user.uid,
      role: 'CLIENT',
      email: user.email,
      phone,
      updatedAt: now,
    }, { merge: true });

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const receipt = `nmw_${jobId.slice(-12)}_${Date.now().toString(36)}`;
    let order: { id: string; amount: number; currency: string };
    try {
      const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: state.clientFee * 100,
          currency: 'INR',
          receipt,
          notes: {
            platform: 'NowMyWork',
            job_id: jobId,
            side: 'CLIENT',
            platform_fee_percent: String(clientFeePercent()),
            final_project_amount: String(state.finalAmount),
          },
        }),
      });
      if (!razorpayResponse.ok) {
        console.error('Razorpay Live order creation failed:', await razorpayResponse.text());
        throw new Error('RAZORPAY_ORDER_FAILED');
      }
      order = await razorpayResponse.json() as { id: string; amount: number; currency: string };
    } catch (error) {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(sessionRef);
        if (snapshot.data()?.orderCreationLock === lockId) transaction.update(sessionRef, { orderCreationLock: null, orderCreationLockedAt: null, updatedAt: Timestamp.now() });
      });
      if (error instanceof Error && error.message === 'RAZORPAY_ORDER_FAILED') return jsonError('Razorpay could not create the payment order.', 502);
      throw error;
    }

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(sessionRef);
      if (snapshot.data()?.orderCreationLock !== lockId) throw new Error('PAYMENT_SESSION_CHANGED');
      transaction.update(sessionRef, { clientOrderId: order.id, orderCreationLock: null, orderCreationLockedAt: null, updatedAt: Timestamp.now() });
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      fee: state.clientFee,
      finalAmount: state.finalAmount,
      freelancerFee: state.freelancerFee,
      clientFeePercent: clientFeePercent(),
      freelancerFeePercent: freelancerFeePercent(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'JOB_NOT_FOUND') return jsonError('Project not found.', 404);
    if (message === 'FORBIDDEN') return jsonError('You are not the client for this project.', 403);
    if (message === 'JOB_NOT_PAYABLE') return jsonError('Payment is available after the project is assigned.', 409);
    if (message === 'ORDER_IN_PROGRESS') return jsonError('A payment order is already being prepared. Please try again shortly.', 409);
    if (message === 'INVALID_AMOUNT') return jsonError('Project amount is invalid.');
    if (message === 'PAYMENT_SESSION_CHANGED') return jsonError('The payment session changed while the order was being prepared. Please retry.', 409);
    const result = errorResponse(error);
    console.error('POST /api/payments/create-order', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
