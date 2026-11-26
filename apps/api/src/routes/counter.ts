import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { counterLookupSchema, counterPurchaseSchema, counterRedeemSchema, withinVoidWindow, toUnix } from '@loyallink/shared';
import { db } from '../db/index.js';
import { enrolments, merchants, offers, rewards, users, visits } from '../db/schema.js';
import { parse, requireMember, uuidParam } from '../lib/http.js';
import { conflict } from '../lib/errors.js';
import { recordVisit, redeemReward, voidVisit } from '../services/escrow.js';
import { getCounterSession, openCounterSession, setCounterResult } from '../services/presence.js';
import { customerCard, enrolmentView, rewardView } from '../services/views.js';

async function customerAtShop(merchantId: string, userId: string) {
  const [m] = await db.select().from(merchants).where(eq(merchants.id, merchantId));
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const es = await db.select({ e: enrolments, o: offers }).from(enrolments).innerJoin(offers, eq(offers.id, enrolments.offerId))
    .where(and(eq(enrolments.merchantId, merchantId), eq(enrolments.userId, userId), eq(enrolments.status, 'active')));
  const rs = await db.select({ r: rewards, o: offers }).from(rewards).innerJoin(offers, eq(offers.id, rewards.offerId))
    .where(and(eq(rewards.merchantId, merchantId), eq(rewards.userId, userId), eq(rewards.status, 'active')));
  const live = await db.select().from(offers).where(and(eq(offers.merchantId, merchantId), eq(offers.status, 'live')));
  return {
    customer: customerCard(u),
    enrolments: es.map(({ e, o }) => enrolmentView(e, o, m)),
    rewards: rs.filter(({ r }) => r.expiresAt > new Date()).map(({ r, o }) => rewardView(r, m, o)),
    notJoined: live.filter((o) => !es.some(({ e }) => e.offerId === o.id)).map((o) => ({ id: o.id, title: o.title })),
  };
}

export default async function counterRoutes(app: FastifyInstance) {
  const rl = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

  app.post('/m/:mid/counter/lookup', rl, async (req) => {
    const { merchant: m, user } = await requireMember(req, (req.params as { mid: string }).mid);
    if (m.status !== 'approved') throw conflict('NOT_APPROVED', 'Your shop is waiting for verification');
    const { code } = parse(counterLookupSchema, req.body);
    const s = await openCounterSession(m.id, user.id, code);
    return { sessionId: s.id, expiresAt: s.expiresAt, ...(await customerAtShop(m.id, s.userId)) };
  });

  app.post('/m/:mid/counter/purchase', async (req) => {
    const { merchant: m, user } = await requireMember(req, (req.params as { mid: string }).mid);
    const { sessionId, amount } = parse(counterPurchaseSchema, req.body);
    const s = await getCounterSession(sessionId, m.id, user.id);
    const r = await db.transaction((tx) => recordVisit(tx, m.id, s.userId, user.id, amount));
    const result = { kind: 'purchase', amount, outcomes: r.outcomes, at: new Date() };
    await setCounterResult(s.id, result);
    return { visitId: r.visit.id, outcomes: r.outcomes, ...(await customerAtShop(m.id, s.userId)) };
  });

  app.post('/m/:mid/counter/redeem', async (req) => {
    const { merchant: m, user } = await requireMember(req, (req.params as { mid: string }).mid);
    const { sessionId, rewardId, billAmount } = parse(counterRedeemSchema, req.body);
    const s = await getCounterSession(sessionId, m.id, user.id);
    const r = await db.transaction((tx) => redeemReward(tx, m.id, s.userId, user.id, rewardId, billAmount));
    const result = { kind: 'redeem', bill: billAmount, discount: r.used, payable: r.payable, at: new Date() };
    await setCounterResult(s.id, result);
    return { discount: r.used, payable: r.payable, fee: r.fee, reimbursed: r.reimbursed, returned: r.returned, remaining: r.remainingAfter, ...(await customerAtShop(m.id, s.userId)) };
  });

  app.post('/m/:mid/counter/visits/:vid/void', async (req) => {
    const p = req.params as { mid: string; vid: string };
    const { merchant: m } = await requireMember(req, p.mid);
    const r = await db.transaction((tx) => voidVisit(tx, m.id, uuidParam(p.vid)));
    return r;
  });

  app.get('/m/:mid/counter/recent', async (req) => {
    const { merchant: m } = await requireMember(req, (req.params as { mid: string }).mid);
    const rows = await db.select({ v: visits, u: users }).from(visits).innerJoin(users, eq(users.id, visits.userId))
      .where(eq(visits.merchantId, m.id)).orderBy(desc(visits.createdAt)).limit(30);
    const staffIds = [...new Set(rows.map(({ v }) => v.staffId))];
    const staff = staffIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, staffIds)) : [];
    const now = toUnix(new Date());
    return {
      visits: rows.map(({ v, u }) => ({
        id: v.id, amount: v.amount, at: v.createdAt, voidedAt: v.voidedAt, customer: customerCard(u),
        staff: staff.find((s) => s.id === v.staffId)?.name ?? null,
        canVoid: !v.voidedAt && withinVoidWindow(toUnix(v.createdAt), now),
      })),
    };
  });
}
