import { timingSafeEqual, createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/admin';
import { calculateFee, freelancerFeePercent } from '@/lib/fees';
import { getLiveRazorpayCredentials } from '@/lib/razorpay';
import { requireUser, assertRole, errorResponse } from '@/lib/server-auth';

export const runtime = 'nodejs';

function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    assertRole(user.role, 'CLIENT');
    const body = await request.json() as { jobId?: string; razorpayOrderId?: string; razorpayPaymentId?: string; razorpaySignature?: string };
    const jobId = body.jobId?.trim();
    if (!jobId || !body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) return jsonError('Payment verification details are incomplete.');

    const { keyId, keySecret } = getLiveRazorpayCredentials();
    const db = adminDb();
    const jobRef = db.collection('jobs').doc(jobId);
    const sessionRef = db.collection('paymentSessions').doc(jobId);
    const sessionSnapshot = await sessionRef.get();
    if (!sessionSnapshot.exists) return jsonError('Payment session not found.', 404);
    const session = sessionSnapshot.data()!;
    if (String(session.clientId ?? '') !== user.uid) return jsonError('You are not authorized to verify this payment.', 403);

    if (session.clientPaymentStatus === 'PAID') {
      return NextResponse.json({
        success: true,
        clientPaid: true,
        freelancerPaid: false,
        contactsUnlocked: Boolean(session.contactsUnlocked),
        freelancerFee: Number(session.freelancerFee ?? 0),
        freelancerFeePercent: Number(session.freelancerFeePercent ?? freelancerFeePercent()),
      });
    }

    const expectedOrderId = String(session.clientOrderId ?? '');
    if (!expectedOrderId || expectedOrderId !== body.razorpayOrderId) return jsonError('Payment order does not match this project.');

    const expectedSignature = createHmac('sha256', keySecret).update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`).digest('hex');
    const left = Buffer.from(expectedSignature);
    const right = Buffer.from(body.razorpaySignature);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return jsonError('Payment signature verification failed.');

    const jobSnapshot = await jobRef.get();
    if (!jobSnapshot.exists) return jsonError('Project not found.', 404);
    const job = jobSnapshot.data()!;
    if (job.clientId !== user.uid || !job.assignedToId || String(job.assignedToId) !== String(session.freelancerId) || !['ASSIGNED', 'IN_PROGRESS'].includes(String(job.status))) return jsonError('This project is no longer in a payable state.', 409);

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(body.razorpayPaymentId)}`, { headers: { authorization: `Basic ${credentials}` }, cache: 'no-store' });
    if (!paymentResponse.ok) return jsonError('Could not verify the Razorpay payment status.', 502);
    const payment = await paymentResponse.json() as { id?: string; order_id?: string; status?: string; amount?: number; currency?: string };
    const expectedAmount = Number(session.clientFee ?? 0) * 100;
    if (payment.id !== body.razorpayPaymentId || payment.order_id !== body.razorpayOrderId || payment.status !== 'captured' || payment.amount !== expectedAmount || payment.currency !== 'INR') return jsonError('Payment was not captured for the expected amount.');

    let clientContact: { email?: string | null; phone?: string | null } = { email: user.email, phone: user.token.phone_number ?? null };
    let freelancerContact: { email?: string | null; phone?: string | null } = {};
    const clientPartySnapshot = await db.collection('paymentParties').doc(`${jobId}_${user.uid}`).get();
    if (clientPartySnapshot.exists) {
      const data = clientPartySnapshot.data()!;
      clientContact = {
        email: String(data.email ?? '') || user.email,
        phone: String(data.phone ?? '') || user.token.phone_number || null,
      };
    }

    const freelancerPartySnapshot = await db.collection('paymentParties').doc(`${jobId}_${session.freelancerId}`).get();
    if (freelancerPartySnapshot.exists) {
      const data = freelancerPartySnapshot.data()!;
      freelancerContact = {
        email: String(data.email ?? '') || null,
        phone: String(data.phone ?? '') || null,
      };
    } else if (session.freelancerId) {
      try {
        const authUser = await adminAuth().getUser(String(session.freelancerId));
        freelancerContact = { email: authUser.email ?? null, phone: authUser.phoneNumber ?? null };
      } catch {
        freelancerContact = {};
      }
    }

    const now = Timestamp.now();
    const contactsUnlocked = Boolean(clientContact.email || clientContact.phone) && Boolean(freelancerContact.email || freelancerContact.phone);
    await db.runTransaction(async (transaction) => {
      const latest = await transaction.get(sessionRef);
      if (!latest.exists) throw new Error('PAYMENT_SESSION_NOT_FOUND');
      if (latest.data()?.clientPaymentStatus === 'PAID') return;
      transaction.update(sessionRef, {
        clientPaymentStatus: 'PAID',
        clientPaymentId: body.razorpayPaymentId,
        freelancerPaymentStatus: latest.data()?.freelancerPaymentStatus ?? 'PAYOUT_PENDING',
        contactsUnlocked,
        updatedAt: now,
      });
      if (contactsUnlocked) {
        transaction.set(db.collection('contactUnlocks').doc(jobId), {
          jobId,
          client: { email: clientContact.email ?? null, phone: clientContact.phone ?? null },
          freelancer: { email: freelancerContact.email ?? null, phone: freelancerContact.phone ?? null },
          unlockedAt: now,
        }, { merge: true });
      }
    });

    return NextResponse.json({
      success: true,
      clientPaid: true,
      freelancerPaid: false,
      contactsUnlocked,
      freelancerFee: Number(session.freelancerFee ?? calculateFee(Number(session.finalAmount ?? 0), freelancerFeePercent())),
      freelancerFeePercent: Number(session.freelancerFeePercent ?? freelancerFeePercent()),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'PAYMENT_SESSION_NOT_FOUND') return jsonError('Payment session not found.', 404);
    const result = errorResponse(error);
    console.error('POST /api/payments/verify', error);
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
}
