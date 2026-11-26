import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { merchants, payments } from '../db/schema.js';
import { badRequest, notFound } from '../lib/errors.js';
import { parse, requireMember, uuidParam } from '../lib/http.js';
import { confirmPayment, markFailed, markPaid, razorpayWebhookOk } from '../services/payments.js';
import { config } from '../config.js';

const confirmSchema = z.object({
  simulate: z.enum(['success', 'failure']).optional(),
  razorpay_payment_id: z.string().max(100).optional(),
  razorpay_order_id: z.string().max(100).optional(),
  razorpay_signature: z.string().max(200).optional(),
});

export default async function paymentRoutes(app: FastifyInstance) {
  async function load(req: Parameters<typeof requireMember>[0], id: string) {
    const [p] = await db.select().from(payments).where(eq(payments.id, uuidParam(id, 'Payment not found')));
    if (!p) throw notFound('Payment not found');
    await requireMember(req, p.merchantId);
    return p;
  }

  app.get('/payments/:id', async (req) => {
    const p = await load(req, (req.params as { id: string }).id);
    const [m] = await db.select({ name: merchants.name }).from(merchants).where(eq(merchants.id, p.merchantId));
    return { payment: p, merchantName: m?.name, razorpayKeyId: config.PAYMENTS_PROVIDER === 'razorpay' ? config.RAZORPAY_KEY_ID : null };
  });

  app.post('/payments/:id/confirm', async (req) => {
    const p = await load(req, (req.params as { id: string }).id);
    const body = parse(confirmSchema, req.body);
    const r = await confirmPayment(p.id, body);
    return { payment: r };
  });

  // Razorpay webhook (backup path if the browser closes before confirm).
  app.register(async (scoped) => {
    scoped.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => done(null, body));
    scoped.post('/webhooks/razorpay', async (req) => {
      const raw = req.body as string;
      const sig = req.headers['x-razorpay-signature'];
      if (typeof sig !== 'string' || !razorpayWebhookOk(raw, sig)) throw badRequest('BAD_SIGNATURE');
      const evt = JSON.parse(raw) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number } } } };
      const ent = evt.payload?.payment?.entity;
      if (!ent) return { ok: true };
      const [p] = await db.select().from(payments).where(eq(payments.providerOrderId, ent.order_id));
      if (!p) return { ok: true };
      if (evt.event === 'payment.captured' && ent.amount === p.amount) await markPaid(p.id, ent.id);
      if (evt.event === 'payment.failed') await markFailed(p.id);
      return { ok: true };
    });
  });
}
