import type { FastifyInstance } from 'fastify';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CATEGORIES, PLAN_LIMITS, PRO_PRICE_PAISE } from '@loyallink/shared';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { enrolments, merchants, offers, waitlist } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { parse, uuidParam } from '../lib/http.js';
import { offerView, shopView } from '../services/views.js';
import { chainStatus, getChain } from '../chain/index.js';

const listQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
});

export default async function publicRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    await db.execute(sql`select 1`);
    return { ok: true, db: 'up', chain: { mode: config.CHAIN_MODE, ...chainStatus } };
  });

  app.get('/config', async () => {
    const c = getChain();
    return {
      paymentsProvider: config.PAYMENTS_PROVIDER,
      razorpayKeyId: config.PAYMENTS_PROVIDER === 'razorpay' ? config.RAZORPAY_KEY_ID : null,
      otpDevEcho: config.OTP_DEV_ECHO,
      chain: c ? { mode: config.CHAIN_MODE, chainId: c.chainId, name: config.CHAIN_NAME, escrow: c.escrow, token: c.token, explorer: config.EXPLORER_URL || null } : { mode: 'off' },
      plans: { free: { ...PLAN_LIMITS.free, liveOffers: 1 }, pro: { price: PRO_PRICE_PAISE, liveOffers: null, poolCap: null, staff: PLAN_LIMITS.pro.staff } },
      feeBps: config.FEE_BPS,
      categories: CATEGORIES,
    };
  });

  app.get('/offers', async (req) => {
    const q = parse(listQuery, req.query);
    const conds = [eq(offers.status, 'live'), eq(merchants.status, 'approved'), eq(merchants.frozen, false)];
    if (q.category) conds.push(eq(merchants.category, q.category));
    if (q.city) conds.push(ilike(merchants.city, q.city));
    if (q.q) {
      const like = `%${q.q.replace(/[%_]/g, '')}%`;
      conds.push(or(ilike(merchants.name, like), ilike(offers.title, like), ilike(merchants.city, like))!);
    }
    const rows = await db.select({ o: offers, m: merchants }).from(offers).innerJoin(merchants, eq(merchants.id, offers.merchantId))
      .where(and(...conds)).orderBy(desc(offers.publishedAt)).limit(200);
    const origin = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng } : undefined;
    const list = rows.map(({ o, m }) => offerView(o, m, origin));
    if (origin) list.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    return { offers: list };
  });

  app.get('/offers/:id', async (req) => {
    const id = uuidParam((req.params as { id: string }).id, 'Offer not found');
    const [row] = await db.select({ o: offers, m: merchants }).from(offers).innerJoin(merchants, eq(merchants.id, offers.merchantId)).where(eq(offers.id, id));
    if (!row || row.o.status === 'draft') throw notFound('Offer not found');
    let mine = null;
    let waitlisted = false;
    if (req.user) {
      const es = await db.select().from(enrolments).where(and(eq(enrolments.offerId, id), eq(enrolments.userId, req.user.id))).orderBy(desc(enrolments.startedAt));
      const active = es.find((e) => e.status === 'active');
      mine = {
        activeEnrolmentId: active?.id ?? null,
        completedTimes: es.filter((e) => e.status === 'completed').length,
      };
      waitlisted = (await db.select().from(waitlist).where(and(eq(waitlist.offerId, id), eq(waitlist.userId, req.user.id)))).length > 0;
    }
    const [{ wl }] = await db.select({ wl: sql<number>`count(*)::int` }).from(waitlist).where(eq(waitlist.offerId, id));
    return { offer: offerView(row.o, row.m), mine, waitlisted, waitlistCount: wl };
  });

  app.get('/shops/:slug', async (req) => {
    const slug = (req.params as { slug: string }).slug;
    const [m] = await db.select().from(merchants).where(eq(merchants.slug, slug));
    if (!m || m.status !== 'approved') throw notFound('Shop not found');
    const os = await db.select().from(offers).where(and(eq(offers.merchantId, m.id), eq(offers.status, 'live')));
    return { shop: shopView(m), offers: os.map((o) => offerView(o, m)) };
  });
}
