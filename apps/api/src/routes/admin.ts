import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { enrolments, ledgerEvents, merchantMembers, merchants, payouts, redemptions, rewards, users, visits, offers } from '../db/schema.js';
import { conflict, notFound } from '../lib/errors.js';
import { parse, requireAdmin, uuidParam } from '../lib/http.js';
import { appendLedger } from '../services/ledger.js';
import { lockMerchant } from '../services/escrow.js';
import { chainStatus, readSolvency } from '../chain/index.js';
import { notify } from '../services/notify.js';

export default async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/overview', async (req) => {
    requireAdmin(req);
    const [{ nUsers }] = await db.select({ nUsers: count() }).from(users);
    const byStatus = await db.select({ status: merchants.status, n: count() }).from(merchants).groupBy(merchants.status);
    const [totals] = await db.select({
      available: sql<number>`coalesce(sum(${merchants.available}),0)::bigint`,
      committed: sql<number>`coalesce(sum(${merchants.committed}),0)::bigint`,
      owed: sql<number>`coalesce(sum(${merchants.owed}),0)::bigint`,
    }).from(merchants);
    const [red] = await db.select({ value: sql<number>`coalesce(sum(${redemptions.used}),0)::bigint`, fees: sql<number>`coalesce(sum(${redemptions.fee}),0)::bigint`, n: count() }).from(redemptions);
    const ledger = await db.select({ status: ledgerEvents.chainStatus, n: count() }).from(ledgerEvents).groupBy(ledgerEvents.chainStatus);
    const [{ oldestPending }] = await db.select({ oldestPending: sql<Date | null>`min(${ledgerEvents.createdAt})` }).from(ledgerEvents).where(eq(ledgerEvents.chainStatus, 'pending'));
    // Balance-mirror invariant (docs/05): committed == Σ reserved of active enrolments, owed == Σ remaining of active rewards.
    const mismatches = await db.execute<{ id: string; name: string; committed: number; expected_committed: number; owed: number; expected_owed: number }>(sql`
      select m.id, m.name, m.committed, coalesce(c.v,0)::bigint as expected_committed, m.owed, coalesce(o.v,0)::bigint as expected_owed
      from merchants m
      left join (select e.merchant_id, sum(ofr.reward_value) v from enrolments e join offers ofr on ofr.id = e.offer_id where e.status='active' group by e.merchant_id) c on c.merchant_id = m.id
      left join (select merchant_id, sum(remaining) v from rewards where status='active' group by merchant_id) o on o.merchant_id = m.id
      where m.committed <> coalesce(c.v,0) or m.owed <> coalesce(o.v,0)`);
    return {
      users: nUsers,
      merchants: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
      pool: { available: Number(totals.available), committed: Number(totals.committed), owed: Number(totals.owed) },
      redemptions: { value: Number(red.value), fees: Number(red.fees), count: red.n },
      ledger: { ...Object.fromEntries(ledger.map((r) => [r.status, r.n])), oldestPending },
      chain: { ...chainStatus, solvency: await readSolvency() },
      invariantMismatches: mismatches.rows,
    };
  });

  app.get('/admin/merchants', async (req) => {
    requireAdmin(req);
    const status = (req.query as { status?: string }).status;
    const rows = await db.select().from(merchants).where(status ? eq(merchants.status, status) : undefined).orderBy(desc(merchants.createdAt)).limit(500);
    const owners = await db.select({ merchantId: merchantMembers.merchantId, phone: users.phone, name: users.name }).from(merchantMembers)
      .innerJoin(users, eq(users.id, merchantMembers.userId)).where(eq(merchantMembers.role, 'owner'));
    return { merchants: rows.map((m) => ({ ...m, owner: owners.find((o) => o.merchantId === m.id) ?? null })) };
  });

  const reasonSchema = z.object({ reason: z.string().trim().max(300).optional() });

  app.post('/admin/merchants/:id/:action', async (req) => {
    requireAdmin(req);
    const p = req.params as { id: string; action: string };
    const id = uuidParam(p.id, 'Shop not found');
    const { reason } = parse(reasonSchema, req.body);
    const result = await db.transaction(async (tx) => {
      const m = await lockMerchant(tx, id);
      const owner = (await tx.select().from(merchantMembers).where(and(eq(merchantMembers.merchantId, id), eq(merchantMembers.role, 'owner'))))[0];
      switch (p.action) {
        case 'approve': {
          if (m.status === 'approved') return m;
          const [u] = await tx.update(merchants).set({ status: 'approved', approvedAt: new Date(), rejectionReason: null }).where(eq(merchants.id, id)).returning();
          await appendLedger(tx, 'merchant.registered', { merchantId: id }, { subjectId: id, merchantId: id });
          if (owner) await notify(tx, { userId: owner.userId, kind: 'shop', title: `${m.name} is verified`, body: 'You can now add money to your reward pool and launch offers.', link: `/m/${id}`, dedupeKey: `approved:${id}` });
          return u;
        }
        case 'reject': {
          if (m.status === 'approved') throw conflict('ALREADY_APPROVED', 'Use freeze for approved shops');
          const [u] = await tx.update(merchants).set({ status: 'rejected', rejectionReason: reason ?? 'Details could not be verified' }).where(eq(merchants.id, id)).returning();
          if (owner) await notify(tx, { userId: owner.userId, kind: 'shop', title: `We couldn't verify ${m.name}`, body: reason ?? 'Please check your details and contact support.', link: `/m/${id}/settings` });
          return u;
        }
        case 'freeze':
        case 'unfreeze': {
          const frozen = p.action === 'freeze';
          if (m.frozen === frozen) return m;
          const [u] = await tx.update(merchants).set({ frozen }).where(eq(merchants.id, id)).returning();
          if (m.status === 'approved') await appendLedger(tx, 'merchant.frozen', { merchantId: id, frozen }, { subjectId: id, merchantId: id });
          return u;
        }
        default:
          throw notFound('Unknown action');
      }
    });
    return { merchant: result };
  });

  app.get('/admin/payouts', async (req) => {
    requireAdmin(req);
    const rows = await db.select({ p: payouts, shop: merchants.name }).from(payouts).innerJoin(merchants, eq(merchants.id, payouts.merchantId)).orderBy(desc(payouts.createdAt)).limit(300);
    return { payouts: rows.map(({ p, shop }) => ({ ...p, shop })) };
  });

  app.post('/admin/payouts/:id/paid', async (req) => {
    requireAdmin(req);
    const id = uuidParam((req.params as { id: string }).id);
    const { reference } = parse(z.object({ reference: z.string().trim().min(3).max(100) }), req.body);
    const [p] = await db.update(payouts).set({ status: 'paid', reference, paidAt: new Date() }).where(and(eq(payouts.id, id), eq(payouts.status, 'requested'))).returning();
    if (!p) throw conflict('NOT_REQUESTED', 'Payout is not pending');
    await db.transaction((tx) => appendLedger(tx, 'payout.paid', { payoutId: id, merchantId: p.merchantId, amount: p.amount }, { subjectId: id, merchantId: p.merchantId }));
    return { payout: p };
  });

  app.get('/admin/ledger', async (req) => {
    requireAdmin(req);
    const status = (req.query as { status?: string }).status;
    const rows = await db.select().from(ledgerEvents).where(status ? eq(ledgerEvents.chainStatus, status) : undefined).orderBy(desc(ledgerEvents.seq)).limit(200);
    return { events: rows };
  });

  app.post('/admin/ledger/:seq/retry', async (req) => {
    requireAdmin(req);
    const seq = Number((req.params as { seq: string }).seq);
    const [e] = await db.update(ledgerEvents).set({ chainStatus: 'pending', attempts: 0, nextAttemptAt: null, error: null })
      .where(and(eq(ledgerEvents.seq, seq), eq(ledgerEvents.chainStatus, 'failed'))).returning();
    if (!e) throw notFound('No failed event with that number');
    return { event: e };
  });

  /** Simple fraud heuristics (docs/09): scan velocity and void rates. */
  app.get('/admin/flags', async (req) => {
    requireAdmin(req);
    const velocity = await db.execute(sql`
      select v.merchant_id, m.name as shop, v.user_id, count(*)::int as scans, min(v.created_at) as first_at, max(v.created_at) as last_at
      from visits v join merchants m on m.id = v.merchant_id
      where v.created_at > now() - interval '7 days'
      group by v.merchant_id, m.name, v.user_id, date_trunc('hour', v.created_at)
      having count(*) >= 4 order by scans desc limit 50`);
    const voids = await db.execute(sql`
      select v.merchant_id, m.name as shop, count(*)::int as visits, count(v.voided_at)::int as voided
      from visits v join merchants m on m.id = v.merchant_id
      where v.created_at > now() - interval '30 days'
      group by v.merchant_id, m.name having count(*) >= 10 and count(v.voided_at)::float / count(*) > 0.15 limit 50`);
    return { velocity: velocity.rows, voidRates: voids.rows };
  });

  app.get('/admin/stats', async (req) => {
    requireAdmin(req);
    const [e] = await db.select({ n: count() }).from(enrolments);
    const [v] = await db.select({ n: count() }).from(visits);
    const [r] = await db.select({ n: count() }).from(rewards);
    const [o] = await db.select({ n: count() }).from(offers).where(eq(offers.status, 'live'));
    return { enrolments: e.n, visits: v.n, rewards: r.n, liveOffers: o.n };
  });
}
