import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { counterSessions, enrolments, merchants, notifications, offers, presenceCodes, purchases, redemptions, rewards, visits, waitlist } from '../db/schema.js';
import { conflict, notFound } from '../lib/errors.js';
import { requireUser, uuidParam } from '../lib/http.js';
import { cancelEnrolment, joinOffer } from '../services/escrow.js';
import { issuePresence } from '../services/presence.js';
import { enrolmentView, rewardView } from '../services/views.js';

export default async function customerRoutes(app: FastifyInstance) {
  app.get('/c/home', async (req) => {
    const u = requireUser(req);
    const act = await db.select({ e: enrolments, o: offers, m: merchants }).from(enrolments)
      .innerJoin(offers, eq(offers.id, enrolments.offerId)).innerJoin(merchants, eq(merchants.id, enrolments.merchantId))
      .where(and(eq(enrolments.userId, u.id), eq(enrolments.status, 'active'))).orderBy(enrolments.deadline);
    const rs = await db.select({ r: rewards, m: merchants, o: offers }).from(rewards)
      .innerJoin(merchants, eq(merchants.id, rewards.merchantId)).innerJoin(offers, eq(offers.id, rewards.offerId))
      .where(and(eq(rewards.userId, u.id), eq(rewards.status, 'active'))).orderBy(rewards.expiresAt);
    const [{ unread }] = await db.select({ unread: count() }).from(notifications).where(and(eq(notifications.userId, u.id), isNull(notifications.readAt)));
    return {
      enrolments: act.map(({ e, o, m }) => enrolmentView(e, o, m)),
      rewards: rs.map(({ r, m, o }) => rewardView(r, m, o)),
      unread,
    };
  });

  app.post('/c/offers/:id/join', async (req) => {
    const u = requireUser(req);
    const id = uuidParam((req.params as { id: string }).id, 'Offer not found');
    const e = await db.transaction((tx) => joinOffer(tx, u.id, id));
    await db.delete(waitlist).where(and(eq(waitlist.offerId, id), eq(waitlist.userId, u.id)));
    const [o] = await db.select().from(offers).where(eq(offers.id, id));
    const [m] = await db.select().from(merchants).where(eq(merchants.id, o.merchantId));
    return { enrolment: enrolmentView(e, o, m) };
  });

  app.post('/c/offers/:id/waitlist', async (req) => {
    const u = requireUser(req);
    const id = uuidParam((req.params as { id: string }).id, 'Offer not found');
    const [o] = await db.select().from(offers).where(eq(offers.id, id));
    if (!o || o.status === 'draft' || o.status === 'ended') throw notFound('Offer not found');
    await db.insert(waitlist).values({ offerId: id, userId: u.id }).onConflictDoNothing();
    return { ok: true };
  });

  app.delete('/c/offers/:id/waitlist', async (req) => {
    const u = requireUser(req);
    const id = uuidParam((req.params as { id: string }).id);
    await db.delete(waitlist).where(and(eq(waitlist.offerId, id), eq(waitlist.userId, u.id)));
    return { ok: true };
  });

  app.get('/c/enrolments/:id', async (req) => {
    const u = requireUser(req);
    const id = uuidParam((req.params as { id: string }).id);
    const [row] = await db.select({ e: enrolments, o: offers, m: merchants }).from(enrolments)
      .innerJoin(offers, eq(offers.id, enrolments.offerId)).innerJoin(merchants, eq(merchants.id, enrolments.merchantId))
      .where(and(eq(enrolments.id, id), eq(enrolments.userId, u.id)));
    if (!row) throw notFound();
    const ps = await db.select().from(purchases).where(eq(purchases.enrolmentId, id)).orderBy(purchases.at);
    let reward = null;
    if (row.e.rewardId) {
      const [r] = await db.select().from(rewards).where(eq(rewards.id, row.e.rewardId));
      if (r) reward = rewardView(r, row.m, row.o);
    }
    return { enrolment: enrolmentView(row.e, row.o, row.m), purchases: ps.map((p) => ({ id: p.id, amount: p.amount, at: p.at, voided: p.voided })), reward };
  });

  app.post('/c/enrolments/:id/cancel', async (req) => {
    const u = requireUser(req);
    const id = uuidParam((req.params as { id: string }).id);
    await db.transaction((tx) => cancelEnrolment(tx, u.id, id));
    return { ok: true };
  });

  app.get('/c/rewards', async (req) => {
    const u = requireUser(req);
    const rs = await db.select({ r: rewards, m: merchants, o: offers }).from(rewards)
      .innerJoin(merchants, eq(merchants.id, rewards.merchantId)).innerJoin(offers, eq(offers.id, rewards.offerId))
      .where(eq(rewards.userId, u.id)).orderBy(desc(rewards.issuedAt)).limit(200);
    return { rewards: rs.map(({ r, m, o }) => rewardView(r, m, o)) };
  });

  app.get('/c/activity', async (req) => {
    const u = requireUser(req);
    const vs = await db.select({ v: visits, shop: merchants.name }).from(visits).innerJoin(merchants, eq(merchants.id, visits.merchantId))
      .where(eq(visits.userId, u.id)).orderBy(desc(visits.createdAt)).limit(100);
    const es = await db.select({ e: enrolments, title: offers.title, shop: merchants.name, reserved: offers.rewardValue }).from(enrolments)
      .innerJoin(offers, eq(offers.id, enrolments.offerId)).innerJoin(merchants, eq(merchants.id, enrolments.merchantId))
      .where(eq(enrolments.userId, u.id)).orderBy(desc(enrolments.startedAt)).limit(100);
    const rd = await db.select({ r: redemptions, shop: merchants.name }).from(redemptions).innerJoin(merchants, eq(merchants.id, redemptions.merchantId))
      .where(eq(redemptions.userId, u.id)).orderBy(desc(redemptions.createdAt)).limit(100);
    const rw = await db.select({ r: rewards, shop: merchants.name }).from(rewards).innerJoin(merchants, eq(merchants.id, rewards.merchantId))
      .where(eq(rewards.userId, u.id)).orderBy(desc(rewards.issuedAt)).limit(100);
    const items = [
      ...vs.map(({ v, shop }) => ({ kind: v.voidedAt ? 'purchase_voided' : 'purchase', at: v.createdAt, shop, amount: v.amount, id: v.id })),
      ...es.map(({ e, title, shop, reserved }) => ({ kind: 'joined', at: e.startedAt, shop, amount: reserved, title, id: e.id })),
      ...es.filter(({ e }) => e.status === 'expired' || e.status === 'cancelled').map(({ e, title, shop }) => ({ kind: `enrolment_${e.status}`, at: e.closedAt ?? e.deadline, shop, amount: 0, title, id: e.id })),
      ...rw.map(({ r, shop }) => ({ kind: 'reward', at: r.issuedAt, shop, amount: r.value, id: r.id })),
      ...rd.map(({ r, shop }) => ({ kind: 'redeemed', at: r.createdAt, shop, amount: r.used, id: r.id })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    return { items: items.slice(0, 150) };
  });

  app.post('/c/presence', async (req) => {
    const u = requireUser(req);
    return issuePresence(u.id);
  });

  /** Polled by the QR screen so the customer sees the counter result live. */
  app.get('/c/presence/:code/status', async (req) => {
    const u = requireUser(req);
    const code = (req.params as { code: string }).code;
    const [p] = await db.select().from(presenceCodes).where(and(eq(presenceCodes.code, code), eq(presenceCodes.userId, u.id)));
    // Latest counter session for this customer (any recent code), so a scan with the
    // previous, still-valid code also shows up live on the customer's screen.
    const [s] = await db.select().from(counterSessions)
      .where(and(eq(counterSessions.userId, u.id), gt(counterSessions.createdAt, new Date(Date.now() - 5 * 60_000))))
      .orderBy(desc(counterSessions.createdAt)).limit(1);
    if (!p && !s) throw conflict('CODE_EXPIRED', 'Code expired');
    return { scanned: !!s, result: s?.lastResult ?? null, expiresAt: p?.expiresAt ?? null };
  });

  app.get('/c/notifications', async (req) => {
    const u = requireUser(req);
    const items = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(100);
    return { items };
  });

  app.post('/c/notifications/read', async (req) => {
    const u = requireUser(req);
    const ids = (req.body as { ids?: string[] })?.ids;
    const cond = ids?.length ? and(eq(notifications.userId, u.id), inArray(notifications.id, ids.filter((i) => /^[0-9a-f-]{36}$/.test(i)))) : eq(notifications.userId, u.id);
    await db.update(notifications).set({ readAt: new Date() }).where(and(cond, isNull(notifications.readAt)));
    return { ok: true };
  });
}
