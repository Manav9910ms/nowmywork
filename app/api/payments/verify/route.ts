import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerDocument, setServerDocument, verifyFirebaseIdToken } from '@/lib/server-firestore';

export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function signaturesEqual(a: string, b: string) {
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '').update(a).digest('hex');
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return jsonError('Sign in is required.', 401);
    const token = await verifyFirebaseIdToken(authorization.slice(7));
    const body = await request.json() as {
      jobId?: string;
      role?: 'CLIENT' | 'FREELANCER';
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    if (!body.jobId || body.role !== 'CLIENT' || !body.razorpayOrderId || !body.razorpayPaymentId || !body.razorpaySignature) {
      return jsonError('Only the client upfront payment can be verified here.');
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return jsonError('Razorpay test keys are not configured on the server.', 500);

    const sessionPath = `paymentSessions/${body.jobId}`;
    const sessionResult = await getServerDocument<Record<string, unknown>>(sessionPath);
    if (!sessionResult.exists || !sessionResult.data) return jsonError('Payment session not found.', 404);
    const session = sessionResult.data;

    const participantId = String(session.clientId ?? '');
    if (participantId !== token.uid) return jsonError('You are not authorized to verify this payment.', 403);

    const expectedOrderId = String(session.clientOrderId ?? '');
    if (!expectedOrderId || expectedOrderId !== body.razorpayOrderId) return jsonError('Payment order does not match this project.', 400);

    if (!signaturesEqual(`${body.razorpayOrderId}|${body.razorpayPaymentId}`, body.razorpaySignature)) {
      return jsonError('Payment signature verification failed.', 400);
    }

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(body.razorpayPaymentId)}`, {
      headers: { authorization: `Basic ${credentials}` },
      cache: 'no-store',
    });
    if (!paymentResponse.ok) return jsonError('Could not verify the Razorpay payment status.', 502);

    const payment = await paymentResponse.json() as {
      id?: string;
      order_id?: string;
      status?: string;
      amount?: number;
      currency?: string;
    };
    const expectedAmount = Number(session.clientFee ?? 0) * 100;
    if (payment.id !== body.razorpayPaymentId || payment.order_id !== body.razorpayOrderId || payment.status !== 'captured' || payment.amount !== expectedAmount || payment.currency !== 'INR') {
      return jsonError('Payment was not captured for the expected amount.', 400);
    }

    const now = new Date();
    const updatedSession: Record<string, unknown> = {
      ...session,
      clientPaymentStatus: 'PAID',
      clientPaymentId: body.razorpayPaymentId,
      freelancerPaymentStatus: session.freelancerPaymentStatus ?? 'PAYOUT_PENDING',
      freelancerFee: Number(session.freelancerFee ?? Math.round(Number(session.finalAmount ?? 0) * 0.10)),
      contactsUnlocked: true,
      updatedAt: now,
    };

    const clientParty = await getServerDocument<Record<string, unknown>>(`paymentParties/${body.jobId}_${session.clientId}`);
    const freelancerParty = await getServerDocument<Record<string, unknown>>(`paymentParties/${body.jobId}_${session.freelancerId}`);
    if (!clientParty.data || !freelancerParty.data) return jsonError('Participant contact information is not ready yet.', 409);

    await setServerDocument(`contactUnlocks/${body.jobId}`, {
      jobId: body.jobId,
      client: { email: clientParty.data.email ?? null, phone: clientParty.data.phone ?? null },
      freelancer: { email: freelancerParty.data.email ?? null, phone: freelancerParty.data.phone ?? null },
      unlockedAt: now,
    });

    const latest = await getServerDocument<Record<string, unknown>>(sessionPath);
    await setServerDocument(sessionPath, updatedSession, latest.updateTime);

    return NextResponse.json({
      success: true,
      clientPaid: true,
      freelancerPaid: false,
      contactsUnlocked: true,
      freelancerFee: updatedSession.freelancerFee,
    });
  } catch (error) {
    console.error(error);
    return jsonError(error instanceof Error ? error.message : 'Could not verify payment.', 500);
  }
}
