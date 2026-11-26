import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { adminPhones, config } from '../config.js';
import { db } from '../db/index.js';
import { otpCodes, sessions, users, type User } from '../db/schema.js';
import { customerRefFor, hmac, randomDigits, randomToken, safeEqual, sha256 } from '../lib/crypto.js';
import { badRequest, tooMany } from '../lib/errors.js';
import { sendSms } from './sms.js';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_WINDOW = 5;
const OTP_WINDOW_MS = 15 * 60_000;
export const SESSION_TTL_MS = 30 * 24 * 3600_000;
export const SESSION_COOKIE = 'll_session';

const codeHash = (phone: string, code: string) => hmac(config.SESSION_SECRET, `otp:${phone}:${code}`);

export async function requestOtp(phone: string, locale: 'en' | 'hi' = 'en') {
  const since = new Date(Date.now() - OTP_WINDOW_MS);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(otpCodes).where(and(eq(otpCodes.phone, phone), gt(otpCodes.createdAt, since)));
  if (n >= OTP_MAX_PER_WINDOW) throw tooMany('Too many codes requested. Please wait a few minutes.');
  const code = randomDigits(6);
  await db.insert(otpCodes).values({ phone, codeHash: codeHash(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  const text = locale === 'hi' ? `${code} आपका LoyalLink कोड है। यह 5 मिनट तक मान्य है।` : `${code} is your LoyalLink code. It is valid for 5 minutes.`;
  await sendSms(phone, text);
  return config.OTP_DEV_ECHO ? { devCode: code } : {};
}

export async function verifyOtp(phone: string, code: string): Promise<{ user: User; isNew: boolean }> {
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp) throw badRequest('OTP_INVALID', 'That code has expired. Ask for a new one.');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw tooMany('Too many wrong codes. Ask for a new one.');
  if (!safeEqual(otp.codeHash, codeHash(phone, code))) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw badRequest('OTP_INVALID', 'That code is not right. Please check and try again.');
  }
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, otp.id));
  return findOrCreateUser(phone);
}

export async function findOrCreateUser(phone: string) {
  const [existing] = await db.select().from(users).where(eq(users.phone, phone));
  const isAdmin = adminPhones().includes(phone);
  if (existing) {
    if (isAdmin && !existing.isAdmin) await db.update(users).set({ isAdmin: true }).where(eq(users.id, existing.id));
    return { user: { ...existing, isAdmin: existing.isAdmin || isAdmin }, isNew: false };
  }
  const id = randomUUID();
  const [user] = await db.insert(users).values({ id, phone, customerRef: customerRefFor(id), isAdmin }).returning();
  return { user, isNew: true };
}

export async function createSession(userId: string) {
  const token = randomToken();
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) });
  return token;
}

export async function userForToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date()), isNull(users.deletedAt)))
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function destroySession(token: string | undefined) {
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}
