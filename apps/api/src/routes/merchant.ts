import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, gte, inArray, sql, sum } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import {
  amountSchema, memberAddSchema, merchantCreateSchema, merchantUpdateSchema, offerCreateSchema, offerUpdateSchema,
  PLAN_LIMITS, PRO_PRICE_PAISE, validateTerms,
} from '@loyallink/shared';
import { db } from '../db/index.js';
import {
  enrolments, merchantMembers, merchants, offers, payouts, poolMovements, redemptions, rewards, users, visits,
} from '../db/schema.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { parse, requireMember, requireUser, sendCsv, uuidParam } from '../lib/http.js';
import { assertTopupAllowed, planOf, publishOffer, setOfferState, withdrawFromPool } from '../services/escrow.js';
import { createPayment } from '../services/payments.js';
import { findOrCreateUser } from '../services/auth.js';
import { customerCard, enrolmentView, offerView } from '../services/views.js';

function slugify(name: string) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'shop';
  return `${base}-${randomBytes(2).toString('hex')}`;
}

export function merchantView(m: typeof merchants.$inferSelect, role?: string) {
  const plan = planOf(m);
  return {
    ...m,
    role,
    plan,
    limits: { liveOffers: plan === 'pro' ? null : PLAN_LIMITS.free.liveOffers, poolCap: plan === 'pro' ? null : PLAN_LIMITS.free.poolCap, staff: PLAN_LIMITS[plan].staff, csvExport: PLAN_LIMITS[plan].csvExport },
  };
}

async function offerOf(merchantId: string, oid: string) {
  const [o] = await db.select().from(offers).where(and(eq(offers.id, uuidParam(oid, 'Offer not found')), eq(offers.merchantId, merchantId)));
  if (!o) throw notFound('Offer not found');
  return o;
}

export default async function merchantRoutes(app: FastifyInstance) {
  app.post('/merchants', async (req) => {
    const u = requireUser(req);
    const body = parse(merchantCreateSchema, req.body);
    const owned = await db.select().from(merchantMembers).where(and(eq(merchantMembers.userId, u.id), eq(merchantMembers.role, 'owner')));
    if (owned.length >= 5) throw conflict('LIMIT', 'You can register up to 5 shops');
    const m = await db.transaction(async (tx) => {
      const [m] = await tx.insert(merchants).values({
        ...body, slug: slugify(body.name), gstin: body.gstin || null, pan: body.pan || null,
        lat: body.lat ?? null, lng: body.lng ?? null, phone: body.phone ?? u.phone,
      }).returning();
      await tx.insert(merchantMembers).values({ merchantId: m.id, userId: u.id, role: 'owner' });
      return m;
    });
    return { merchant: merchantView(m, 'owner') };
  });

  app.get('/m/:mid', async (req) => {
    const { merchant, role } = await requireMember(req, (req.params as { mid: string }).mid);
    return { merchant: merchantView(merchant, role) };
  });

  app.patch('/m/:mid', async (req) => {
    const { merchant } = await requireMember(req, (req.params as { mid: string }).mid, 'owner');
    const body = parse(merchantUpdateSchema, req.body);
    const [m] = await db.update(merchants).set({ ...body, gstin: body.gstin === '' ? null : body.gstin, pan: body.pan === '' ? null : body.pan }).where(eq(merchants.id, merchant.id)).returning();
    return { merchant: merchantView(m, 'owner') };
  });

  app.get('/m/:mid/dashboard', async (req) => {
    const { merchant: m } = await requireMember(req, (req.params as { mid: string }).mid);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [{ live }] = await db.select({ live: count() }).from(offers).where(and(eq(offers.merchantId, m.id), eq(offers.status, 'live')));
    const byStatus = await db.select({ status: enrolments.status, n: count() }).from(enrolments).where(eq(enrolments.merchantId, m.id)).groupBy(enrolments.status);
    const st = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Record<string, number>;
    const [{ progressing }] = await db.select({ progressing: count() }).from(enrolments).where(and(eq(enrolments.merchantId, m.id), eq(enrolments.status, 'active'), gte(enrolments.purchases, 1)));
    const [{ redeemedRewards }] = await db.select({ redeemedRewards: sql<number>`count(distinct ${redemptions.rewardId})::int` }).from(redemptions).where(eq(redemptions.merchantId, m.id));
    const [{ redeemedMonth }] = await db.select({ redeemedMonth: sql<number>`coalesce(sum(${redemptions.used}),0)::bigint` }).from(redemptions).where(and(eq(redemptions.merchantId, m.id), gte(redemptions.createdAt, monthStart)));
    const [{ salesMonth }] = await db.select({ salesMonth: sql<number>`coalesce(sum(${visits.amount}),0)::bigint` }).from(visits).where(and(eq(visits.merchantId, m.id), gte(visits.createdAt, monthStart), sql`${visits.voidedAt} is null`));
    const repeat = await db.execute<{ customers: number; repeaters: number }>(sql`
      select count(*)::int as customers, count(*) filter (where n >= 2)::int as repeaters
      from (select user_id, count(*) n from visits where merchant_id = ${m.id} and created_at >= ${since30} and voided_at is null group by user_id) t`);
    const [{ avgDays }] = await db.select({ avgDays: sql<number | null>`avg(extract(epoch from (${enrolments.closedAt} - ${enrolments.startedAt})) / 86400)::float` })
      .from(enrolments).where(and(eq(enrolments.merchantId, m.id), eq(enrolments.status, 'completed')));
    const recentVisits = await db.select({ v: visits, u: users }).from(visits).innerJoin(users, eq(users.id, visits.userId))
      .where(eq(visits.merchantId, m.id)).orderBy(desc(visits.createdAt)).limit(10);
    const recentMoves = await db.select().from(poolMovements).where(eq(poolMovements.merchantId, m.id)).orderBy(desc(poolMovements.createdAt)).limit(10);
    const rr = repeat.rows[0] ?? { customers: 0, repeaters: 0 };
    const joined = (st.active ?? 0) + (st.completed ?? 0) + (st.expired ?? 0) + (st.cancelled ?? 0);
    return {
      kpis: {
        liveOffers: live, inProgress: st.active ?? 0, available: m.available, committed: m.committed, owed: m.owed,
        redeemedThisMonth: Number(redeemedMonth), trackedSalesThisMonth: Number(salesMonth),
        repeatRate: rr.customers ? rr.repeaters / rr.customers : null, customers30d: rr.customers,
        completionRate: joined ? (st.completed ?? 0) / joined : null, avgDaysToComplete: avgDays,
      },
      funnel: { joined, progressing: progressing + (st.completed ?? 0), completed: st.completed ?? 0, redeemed: redeemedRewards },
      activity: [
        ...recentVisits.map(({ v, u }) => ({ kind: v.voidedAt ? 'visit_voided' : 'visit', at: v.createdAt, amount: v.amount, customer: customerCard(u) })),
        ...recentMoves.map((p) => ({ kind: `pool_${p.kind}`, at: p.createdAt, amount: p.amount, customer: null })),
      ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 15),
    };
  });

  // ── offers ──
  app.get('/m/:mid/offers', async (req) => {
    const { merchant: m } = await requireMember(req, (req.params as { mid: string }).mid);
    const os = await db.select().from(offers).where(eq(offers.merchantId, m.id)).orderBy(desc(offers.createdAt));
    const stats = await db.select({ offerId: enrolments.offerId, status: enrolments.status, n: count() }).from(enrolments)
      .where(eq(enrolments.merchantId, m.id)).groupBy(enrolments.offerId, enrolments.status);
    return {
      offers: os.map((o) => ({
        ...offerView(o, m),
        stats: Object.fromEntries(stats.filter((s) => s.offerId === o.id).map((s) => [s.status, s.n])),
      })),
    };
  });

  app.post('/m/:mid/offers', async (req) => {
    const { merchant: m } = await requireMember(req, (req.params as { mid: string }).mid, 'owner');
    const body = parse(offerCreateSchema, req.body);
    const t = { ...body, percentBps: body.rewardKind === 'percent' ? body.percentBps : 0 };
    const errs = validateTerms(t);
    if (errs.length) throw badRequest('INVALID_TERMS', `Please check: ${errs.join(', ')}`, errs);
    const [o] = await db.insert(offers).values({ ...t, merchantId: m.id }).returning();
    return { offer: offerView(o, m) };
  });

  app.get('/m/:mid/offers/:oid', async (req) => {
    const p = req.params as { mid: string; oid: string };
    const { merchant: m } = await requireMember(req, p.mid);
    const o = await offerOf(m.id, p.oid);
    const stats = await db.select({ status: enrolments.status, n: count() }).from(enrolments).where(eq(enrolments.offerId, o.id)).groupBy(enrolments.status);
    const [{ redeemed }] = await db.select({ redeemed: sql<number>`count(distinct ${redemptions.rewardId})::int` }).from(redemptions)
      .innerJoin(rewards, eq(rewards.id, redemptions.rewardId)).where(eq(rewards.offerId, o.id));
    return { offer: offerView(o, m), stats: { ...Object.fromEntries(stats.map((s) => [s.status, s.n])), redeemed } };
  });

  app.patch('/m/:mid/offers/:oid', async (req) => {
    const p = req.params as { mid: string; oid: string };
    const { merchant: m } = await requireMember(req, p.mid, 'owner');
    const o = await offerOf(m.id, p.oid);
    const body = parse(offerUpdateSchema, req.body);
    if (o.status !== 'draft') {
      // R4: numeric terms are frozen once published.
      const numeric = Object.keys(body).filter((k) => !['title', 'description'].includes(k));
      if (numeric.length) throw conflict('TERMS_LOCKED', 'Terms cannot change after an offer goes live. End it and publish a new one. People who joined keep their deal.');
    }
    const next = { ...o, ...body };
    if (next.rewardKind === 'credit') next.percentBps = 0;
    if (o.status === 'draft') {
      const errs = validateTerms(next as never);
      if (errs.length) throw badRequest('INVALID_TERMS', `Please check: ${errs.join(', ')}`, errs);
    }
    const [u] = await db.update(offers).set(o.status === 'draft' ? { ...body, percentBps: next.percentBps } : { title: next.title, description: next.description }).where(eq(offers.id, o.id)).returning();
    return { offer: offerView(u, m) };
  });

  for (const action of ['publish', 'pause', 'resume', 'end'] as const) {
    app.post(`/m/:mid/offers/:oid/${action}`, async (req) => {
      const p = req.params as { mid: string; oid: string };
      const { merchant: m } = await requireMember(req, p.mid, 'owner');
      const o = await offerOf(m.id, p.oid);
      const u = await db.transaction((tx) => (action === 'publish' ? publishOffer(tx, o.id) : setOfferState(tx, o.id, action)));
      const [mm] = await db.select().from(merchants).where(eq(merchants.id, m.id));
      return { offer: offerView(u, mm) };
    });
  }

  app.get('/m/:mid/offers/:oid/enrolments', async (req) => {
    const p = req.params as { mid: string; oid: string };
    const { merchant: m } = await requireMember(req, p.mid);
    const o = await offerOf(m.id, p.oid);
    const rows = await db.select({ e: enrolments, u: users }).from(enrolments).innerJoin(users, eq(users.id, enrolments.userId))
      .where(eq(enrolments.offerId, o.id)).orderBy(desc(enrolments.startedAt)).limit(500);
    return { enrolments: rows.map(({ e, u }) => ({ ...enrolmentView(e, o, m), offer: undefined, customer: customerCard(u) })) };
  });

  // ── pool ──
  app.get('/m/:mid/pool', async (req) => {
    const { merchant: m } = await requireMember(req, (req.params as { mid: string }).mid);
    const moves = await db.select().from(poolMovements).where(eq(poolMovements.merchantId, m.id)).orderBy(desc(poolMovements.createdAt)).limit(200);
    const ps = await db.select().from(payouts).where(eq(payouts.merchantId, m.id)).orderBy(desc(payouts.createdAt)).limit(50);
    const [{ fees }] = await db.select({ fees: sql<number>`coalesce(sum(${redemptions.fee}),0)::bigint` }).from(redemptions).where(eq(redemptions.merchantId, m.id));
    return { balances: { available: m.available, committed: m.committed, owed: m.owed }, feesPaid: Number(fees), movements: moves, payouts: ps, merchant: merchantView(m) };
  });

  app.post('/m/:mid/pool/topup', async (req) => {
    const { merchant: m, user } = await requireMember(req, (req.params as { mid: string }).mid, 'owner');
    const { amount } = parse(amountSchema, req.body);
    assertTopupAllowed(m, amount);
    const p = await createPayment(m.id, user.id, 'pool_topup', amount);
    return { payment: p };
  });

  app.post('/m/:mid/pool/withdraw', async (req) => {
    const { merchant: m } = await requireMember(req, (req.params as { mid: string }).mid, 'owner');
    const { amount } = parse(amountSchema, req.body);
    const r = await db.transaction((tx) => withdrawFromPool(tx, m.id, amount));
    return { payout: r.payout, balances: { available: r.merchant.available, committed: r.merchant.committed, owed: r.merchant.owed } };
  });

  app.post('/m/:mid/plan/upgrade', async (req) => {
    const { merchant: m, user } = await requireMember(req, (req.params as { mid: string }).mid, 'owner');
    if (m.status !== 'approved') throw conflict('NOT_APPROVED', 'Your shop is waiting for verification');
    const p = await createPayment(m.id, user.id, 'plan_pro', PRO_PRICE_PAISE);
    return { payment: p };
  });

  // ── customers ──
  app.get('/m/:mid/customers', async (req, reply) => {
    const { merchant: m } = await requireMember(req, (req.params as { mid: string }).mid);
    const rows = await db.select({
      userId: visits.userId, visits: count(), spend: sum(visits.amount), lastVisit: sql<Date>`max(${visits.createdAt})`, firstVisit: sql<Date>`min(${visits.createdAt})`,
    }).from(visits).where(and(eq(visits.merchantId, m.id), sql`${visits.voidedAt} is null`)).groupBy(visits.userId).orderBy(desc(sql`max(${visits.createdAt})`)).limit(1000);
    const ids = rows.map((r) => r.userId);
    const us = ids.length ? await db.select().from(users).where(inArray(users.id, ids)) : [];
    const act = ids.length ? await db.select({ userId: enrolments.userId, n: count() }).from(enrolments).where(and(eq(enrolments.merchantId, m.id), eq(enrolments.status, 'active'), inArray(enrolments.userId, ids))).groupBy(enrolments.userId) : [];
    const list = rows.map((r) => {
      const u = us.find((x) => x.id === r.userId)!;
      return { ...customerCard(u), visits: r.visits, spend: Number(r.spend ?? 0), lastVisit: r.lastVisit, firstVisit: r.firstVisit, activeOffers: act.find((a) => a.userId === r.userId)?.n ?? 0 };
    });
    if ((req.query as { format?: string }).format === 'csv') {
      if (!PLAN_LIMITS[planOf(m)].csvExport) throw conflict('PLAN_LIMIT', 'CSV export is part of Pro');
      return sendCsv(reply, `customers-${m.slug}.csv`, list.map((c) => ({ customer: c.ref, name: c.name, visits: c.visits, spend_rupees: c.spend / 100, first_visit: c.firstVisit, last_visit: c.lastVisit, active_offers: c.activeOffers })));
    }
    return { customers: list };
  });

  // ── team ──
  app.get('/m/:mid/members', async (req) => {
    const { merchant: m } = await requireMember(req, (req.params as { mid: string }).mid);
    const rows = await db.select({ mm: merchantMembers, u: users }).from(merchantMembers).innerJoin(users, eq(users.id, merchantMembers.userId)).where(eq(merchantMembers.merchantId, m.id));
    return { members: rows.map(({ mm, u }) => ({ userId: u.id, name: u.name, phone: u.phone, role: mm.role, since: mm.createdAt })) };
  });

  app.post('/m/:mid/members', async (req) => {
    const { merchant: m } = await requireMember(req, (req.params as { mid: string }).mid, 'owner');
    const { phone, role } = parse(memberAddSchema, req.body);
    const limit = PLAN_LIMITS[planOf(m)].staff;
    const [{ n }] = await db.select({ n: count() }).from(merchantMembers).where(and(eq(merchantMembers.merchantId, m.id), eq(merchantMembers.role, 'staff')));
    if (role === 'staff' && n >= limit) throw conflict('PLAN_LIMIT', limit === 0 ? 'Staff logins are part of Pro' : `Your plan allows ${limit} staff`);
    const { user } = await findOrCreateUser(phone);
    await db.insert(merchantMembers).values({ merchantId: m.id, userId: user.id, role }).onConflictDoUpdate({ target: [merchantMembers.merchantId, merchantMembers.userId], set: { role } });
    return { ok: true };
  });

  app.delete('/m/:mid/members/:uid', async (req) => {
    const p = req.params as { mid: string; uid: string };
    const { merchant: m, user } = await requireMember(req, p.mid, 'owner');
    if (p.uid === user.id) throw conflict('SELF', 'You cannot remove yourself');
    await db.delete(merchantMembers).where(and(eq(merchantMembers.merchantId, m.id), eq(merchantMembers.userId, uuidParam(p.uid))));
    return { ok: true };
  });
}
