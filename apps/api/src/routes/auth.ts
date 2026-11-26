import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { meUpdateSchema, otpRequestSchema, otpVerifySchema } from '@loyallink/shared';
import { config } from '../config.js';
import { db } from '../db/index.js';
import {
  enrolments, merchantMembers, merchants, notifications, redemptions, rewards, sessions, users, visits, waitlist,
} from '../db/schema.js';
import { parse, requireUser } from '../lib/http.js';
import { conflict } from '../lib/errors.js';
import { createSession, destroySession, requestOtp, SESSION_COOKIE, SESSION_TTL_MS, verifyOtp } from '../services/auth.js';
import { cancelEnrolment } from '../services/escrow.js';

export function publicUser(u: typeof users.$inferSelect) {
  return { id: u.id, phone: u.phone, name: u.name, locale: u.locale, isAdmin: u.isAdmin };
}

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/otp/request', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req) => {
    const { phone } = parse(otpRequestSchema, req.body);
    const locale = (req.body as { locale?: string })?.locale === 'hi' ? 'hi' : 'en';
    const r = await requestOtp(phone, locale);
    return { ok: true, phone, ...r };
  });

  app.post('/auth/otp/verify', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const { phone, code } = parse(otpVerifySchema, req.body);
    const { user, isNew } = await verifyOtp(phone, code);
    const locale = (req.body as { locale?: string })?.locale;
    if (isNew && (locale === 'hi' || locale === 'en')) await db.update(users).set({ locale }).where(eq(users.id, user.id));
    const token = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production', path: '/', maxAge: SESSION_TTL_MS / 1000,
    });
    return { user: publicUser({ ...user, locale: isNew && locale ? locale : user.locale }), isNew };
  });

  app.post('/auth/logout', async (req, reply) => {
    await destroySession(req.sessionToken);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/me', async (req) => {
    const u = requireUser(req);
    const memberships = await db
      .select({ merchantId: merchants.id, name: merchants.name, slug: merchants.slug, status: merchants.status, role: merchantMembers.role })
      .from(merchantMembers)
      .innerJoin(merchants, eq(merchants.id, merchantMembers.merchantId))
      .where(eq(merchantMembers.userId, u.id));
    return { user: publicUser(u), memberships };
  });

  app.patch('/me', async (req) => {
    const u = requireUser(req);
    const body = parse(meUpdateSchema, req.body);
    const [nu] = await db.update(users).set(body).where(eq(users.id, u.id)).returning();
    return { user: publicUser(nu) };
  });

  // Invisible Chain step 7: users can leave with their data.
  app.get('/me/export', async (req, reply) => {
    const u = requireUser(req);
    const data = {
      exportedAt: new Date().toISOString(),
      account: publicUser(u),
      enrolments: await db.select().from(enrolments).where(eq(enrolments.userId, u.id)),
      visits: await db.select().from(visits).where(eq(visits.userId, u.id)),
      rewards: await db.select().from(rewards).where(eq(rewards.userId, u.id)),
      redemptions: await db.select().from(redemptions).where(eq(redemptions.userId, u.id)),
      notifications: await db.select().from(notifications).where(eq(notifications.userId, u.id)),
      memberships: await db.select().from(merchantMembers).where(eq(merchantMembers.userId, u.id)),
    };
    return reply.header('content-disposition', 'attachment; filename="loyallink-my-data.json"').send(data);
  });

  app.delete('/me', async (req, reply) => {
    const u = requireUser(req);
    const owner = await db.select().from(merchantMembers).where(and(eq(merchantMembers.userId, u.id), eq(merchantMembers.role, 'owner')));
    if (owner.length) throw conflict('OWNS_SHOP', 'You own a shop. Please contact support to close the shop first.');
    const active = await db.select().from(enrolments).where(and(eq(enrolments.userId, u.id), eq(enrolments.status, 'active')));
    for (const e of active) await db.transaction((tx) => cancelEnrolment(tx, u.id, e.id));
    await db.delete(waitlist).where(eq(waitlist.userId, u.id));
    await db.delete(merchantMembers).where(eq(merchantMembers.userId, u.id));
    await db.delete(notifications).where(eq(notifications.userId, u.id));
    await db.update(users).set({ phone: `deleted:${u.id}`, name: null, deletedAt: new Date() }).where(eq(users.id, u.id));
    await db.delete(sessions).where(eq(sessions.userId, u.id));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
}

