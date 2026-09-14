import { NextRequest, NextResponse } from 'next/server';
import { getServerDocument, setServerDocument, verifyFirebaseIdToken } from '@/lib/server-firestore';

export const runtime = 'nodejs';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return jsonError('Sign in is required.', 401);
    const token = await verifyFirebaseIdToken(authorization.slice(7));
    const body = await request.json() as { jobId?: string; role?: 'CLIENT' | 'FREELANCER'; phone?: string };
    if (!body.jobId || body.role !== 'CLIENT') return jsonError('Only the client pays the upfront platform fee.');

    const jobResult = await getServerDocument<Record<string, unknown>>(`jobs/${body.jobId}`);
    if (!jobResult.exists || !jobResult.data) return jsonError('Project not found.', 404);
    const job = jobResult.data;
    const clientId = String(job.clientId ?? '');
    const freelancerId = String(job.assignedToId ?? '');
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(String(job.status ?? ''))) return jsonError('Payment is available after the project is assigned.');
    if (token.uid !== clientId) return jsonError('You are not the client for this project.', 403);

    const finalAmount = Number(job.budget ?? 0);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) return jsonError('Project amount is invalid.');
    const clientFee = Math.max(1, Math.round(finalAmount * 0.05));
    const freelancerFee = Math.max(1, Math.round(finalAmount * 0.10));

    const sessionPath = `paymentSessions/${body.jobId}`;
    const sessionResult = await getServerDocument<Record<string, unknown>>(sessionPath);
    const current = sessionResult.data ?? {};
    const now = new Date();
    const session = {
      jobId: body.jobId,
      clientId,
      freelancerId,
      finalAmount,
      clientFee,
      freelancerFee,
      currency: 'INR',
      clientPaymentStatus: current.clientPaymentStatus ?? 'PENDING',
      freelancerPaymentStatus: current.freelancerPaymentStatus ?? 'PAYOUT_PENDING',
      clientPaymentId: current.clientPaymentId ?? null,
      clientOrderId: current.clientOrderId ?? null,
      freelancerPaymentId: current.freelancerPaymentId ?? null,
      freelancerOrderId: current.freelancerOrderId ?? null,
      contactsUnlocked: current.contactsUnlocked ?? false,
      createdAt: sessionResult.exists ? (current.createdAt ?? now) : now,
      updatedAt: now,
    };

    if (session.clientPaymentStatus === 'PAID') return NextResponse.json({ alreadyPaid: true, contactsUnlocked: Boolean(session.contactsUnlocked), fee: clientFee, currency: 'INR' });

    const phone = body.phone?.trim() || token.phoneNumber || null;
    await setServerDocument(`paymentParties/${body.jobId}_${token.uid}`, {
      jobId: body.jobId,
      uid: token.uid,
      role: 'CLIENT',
      email: token.email ?? null,
      phone,
      updatedAt: now,
    });

    if (!sessionResult.exists) await setServerDocument(sessionPath, session);
    else await setServerDocument(sessionPath, session, sessionResult.updateTime);

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return jsonError('Razorpay test keys are not configured on the server.', 500);

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const receipt = `nmw_${body.jobId.slice(-12)}_client`;
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: clientFee * 100,
        currency: 'INR',
        receipt,
        notes: {
          platform: 'NowMyWork',
          job_id: body.jobId,
          side: 'CLIENT',
          platform_fee_percent: '5',
          final_project_amount: String(finalAmount),
        },
      }),
    });

    if (!razorpayResponse.ok) {
      console.error('Razorpay order creation failed:', await razorpayResponse.text());
      return jsonError('Razorpay could not create the payment order.', 502);
    }

    const order = await razorpayResponse.json() as { id: string; amount: number; currency: string };
    const latest = await getServerDocument<Record<string, unknown>>(sessionPath);
    await setServerDocument(sessionPath, {
      ...(latest.data ?? session),
      updatedAt: new Date(),
      clientOrderId: order.id,
    }, latest.updateTime);

    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, fee: clientFee, finalAmount, freelancerFee });
  } catch (error) {
    console.error(error);
    return jsonError(error instanceof Error ? error.message : 'Could not create payment order.', 500);
  }
}
