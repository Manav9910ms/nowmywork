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
    if (!body.jobId || (body.role !== 'CLIENT' && body.role !== 'FREELANCER')) return jsonError('Invalid payment request.');

    const jobResult = await getServerDocument<Record<string, unknown>>(`jobs/${body.jobId}`);
    if (!jobResult.exists || !jobResult.data) return jsonError('Project not found.', 404);
    const job = jobResult.data;
    const clientId = String(job.clientId ?? '');
    const freelancerId = String(job.assignedToId ?? '');
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(String(job.status ?? ''))) return jsonError('Payment is available after the project is assigned.');

    const isClient = body.role === 'CLIENT' && token.uid === clientId;
    const isFreelancer = body.role === 'FREELANCER' && token.uid === freelancerId;
    if (!isClient && !isFreelancer) return jsonError('You are not a participant in this project.', 403);

    const finalAmount = Number(job.budget ?? 0);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) return jsonError('Project amount is invalid.');
    const fee = Math.max(1, Math.round(finalAmount * 0.05));

    const sessionPath = `paymentSessions/${body.jobId}`;
    const sessionResult = await getServerDocument<Record<string, unknown>>(sessionPath);
    const current = sessionResult.data ?? {};
    const now = new Date();
    const session = {
      jobId: body.jobId,
      clientId,
      freelancerId,
      finalAmount,
      clientFee: fee,
      freelancerFee: fee,
      currency: 'INR',
      clientPaymentStatus: current.clientPaymentStatus ?? 'PENDING',
      freelancerPaymentStatus: current.freelancerPaymentStatus ?? 'PENDING',
      clientPaymentId: current.clientPaymentId ?? null,
      clientOrderId: current.clientOrderId ?? null,
      freelancerPaymentId: current.freelancerPaymentId ?? null,
      freelancerOrderId: current.freelancerOrderId ?? null,
      contactsUnlocked: current.contactsUnlocked ?? false,
      createdAt: sessionResult.exists ? (current.createdAt ?? now) : now,
      updatedAt: now,
    };

    const alreadyPaid = isClient ? session.clientPaymentStatus === 'PAID' : session.freelancerPaymentStatus === 'PAID';
    if (alreadyPaid) return NextResponse.json({ alreadyPaid: true, contactsUnlocked: Boolean(session.contactsUnlocked), fee, currency: 'INR' });

    const phone = body.phone?.trim() || token.phoneNumber || null;
    await setServerDocument(`paymentParties/${body.jobId}_${token.uid}`, {
      jobId: body.jobId,
      uid: token.uid,
      role: body.role,
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
    const receipt = `nmw_${body.jobId.slice(-12)}_${body.role.toLowerCase()}`;
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/json' },
      body: JSON.stringify({ amount: fee * 100, currency: 'INR', receipt, notes: { platform: 'NowMyWork', job_id: body.jobId, side: body.role, final_project_amount: String(finalAmount) } }),
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
      ...(isClient ? { clientOrderId: order.id } : { freelancerOrderId: order.id }),
    }, latest.updateTime);

    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, fee, finalAmount });
  } catch (error) {
    console.error(error);
    return jsonError(error instanceof Error ? error.message : 'Could not create payment order.', 500);
  }
}
