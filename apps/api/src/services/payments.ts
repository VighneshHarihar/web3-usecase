/**
 * Payments adapter. `sandbox` simulates UPI in dev; `razorpay` uses Orders API + signature checks.
 * Money in/out lives on familiar rails (Invisible Chain step 4).
 */
import { createHmac } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { addDays } from '../lib/time.js';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { merchants, payments } from '../db/schema.js';
import { safeEqual } from '../lib/crypto.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { depositToPool, lockMerchant, planOf } from './escrow.js';
import { appendLedger } from './ledger.js';
import { PRO_PERIOD_DAYS } from '@loyallink/shared';

export type Purpose = 'pool_topup' | 'plan_pro';

export async function createPayment(merchantId: string, userId: string, purpose: Purpose, amount: number) {
  const provider = config.PAYMENTS_PROVIDER;
  const [p] = await db.insert(payments).values({ merchantId, userId, purpose, amount, provider }).returning();
  if (provider === 'razorpay') {
    const order = await razorpayCreateOrder(amount, p.id);
    await db.update(payments).set({ providerOrderId: order.id }).where(eq(payments.id, p.id));
    return { ...p, providerOrderId: order.id };
  }
  return p;
}

async function razorpayCreateOrder(amount: number, receipt: string): Promise<{ id: string }> {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) throw new Error('Razorpay keys are not configured');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Basic ' + Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64'),
    },
    body: JSON.stringify({ amount, currency: 'INR', receipt }),
  });
  if (!res.ok) throw new Error(`Razorpay order failed: ${res.status}`);
  return (await res.json()) as { id: string };
}

export function razorpaySignatureOk(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac('sha256', config.RAZORPAY_KEY_SECRET ?? '').update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

export function razorpayWebhookOk(rawBody: string, signature: string) {
  const expected = createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET ?? '').update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

/** Idempotent: a payment is applied exactly once. */
export async function markPaid(paymentId: string, providerPaymentId: string | null) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for('update');
    if (!p) throw notFound('Payment not found');
    if (p.status === 'paid') return p;
    if (p.status !== 'created') throw conflict('PAYMENT_CLOSED', 'This payment is closed');
    const now = new Date();
    const [u] = await tx.update(payments).set({ status: 'paid', paidAt: now, providerPaymentId }).where(eq(payments.id, p.id)).returning();
    if (p.purpose === 'pool_topup') {
      await depositToPool(tx, p.merchantId, p.amount, p.id, now);
    } else {
      const m = await lockMerchant(tx, p.merchantId);
      const base = planOf(m, now) === 'pro' && m.planRenewsAt ? m.planRenewsAt : now;
      await tx.update(merchants).set({ plan: 'pro', planRenewsAt: addDays(base, PRO_PERIOD_DAYS) }).where(eq(merchants.id, m.id));
      await appendLedger(tx, 'plan.upgraded', { merchantId: m.id, paymentId: p.id, amount: p.amount }, { subjectId: m.id, merchantId: m.id, at: now });
    }
    return u;
  });
}

export async function markFailed(paymentId: string) {
  await db.update(payments).set({ status: 'failed' }).where(and(eq(payments.id, paymentId), eq(payments.status, 'created')));
}

export async function confirmPayment(
  paymentId: string,
  body: { simulate?: 'success' | 'failure'; razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string },
) {
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!p) throw notFound('Payment not found');
  if (p.provider === 'sandbox') {
    if (config.PAYMENTS_PROVIDER !== 'sandbox') throw badRequest('SANDBOX_DISABLED');
    if (body.simulate === 'failure') {
      await markFailed(p.id);
      return { ...p, status: 'failed' };
    }
    return markPaid(p.id, `sandbox_${p.id.slice(0, 8)}`);
  }
  const { razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig } = body;
  if (!pid || !oid || !sig || oid !== p.providerOrderId || !razorpaySignatureOk(oid, pid, sig))
    throw badRequest('PAYMENT_SIGNATURE', 'We could not verify this payment');
  return markPaid(p.id, pid);
}
