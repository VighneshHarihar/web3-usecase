/**
 * Two-party presence (Invisible Chain step 6 "honest limit"): a purchase can only be recorded
 * for a customer who is at the counter showing a fresh code.
 */
import { and, eq, gt, lt } from 'drizzle-orm';
import { COUNTER_SESSION_TTL_SECONDS, PRESENCE_TTL_SECONDS } from '@loyallink/shared';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { counterSessions, presenceCodes } from '../db/schema.js';
import { hmac, randomDigits, safeEqual } from '../lib/crypto.js';
import { addSeconds } from '../lib/time.js';
import { badRequest, conflict } from '../lib/errors.js';

const sig = (code: string) => hmac(config.SESSION_SECRET, `presence:${code}`).slice(0, 16);
export const qrPayload = (code: string) => `LL1.${code}.${sig(code)}`;

export async function issuePresence(userId: string) {
  await db.delete(presenceCodes).where(lt(presenceCodes.expiresAt, new Date()));
  for (let i = 0; i < 8; i++) {
    const code = randomDigits(6);
    const expiresAt = addSeconds(new Date(), PRESENCE_TTL_SECONDS);
    const inserted = await db.insert(presenceCodes).values({ code, userId, expiresAt }).onConflictDoNothing().returning();
    if (inserted.length) return { code, qr: qrPayload(code), expiresAt };
  }
  throw conflict('BUSY', 'Please try again');
}

/** Accepts a 6-digit code or a scanned QR payload. */
export function parsePresenceInput(input: string): string {
  const s = input.trim();
  if (/^\d{6}$/.test(s)) return s;
  const m = /^LL1\.(\d{6})\.([0-9a-f]{16})$/.exec(s);
  if (m && safeEqual(m[2], sig(m[1]))) return m[1];
  throw badRequest('CODE_INVALID', 'That code is not valid. Ask the customer to open their QR again.');
}

export async function openCounterSession(merchantId: string, staffId: string, input: string) {
  const code = parsePresenceInput(input);
  const [p] = await db.select().from(presenceCodes).where(and(eq(presenceCodes.code, code), gt(presenceCodes.expiresAt, new Date())));
  if (!p) throw badRequest('CODE_EXPIRED', 'That code has expired. Ask the customer to refresh their QR.');
  const [s] = await db
    .insert(counterSessions)
    .values({ merchantId, userId: p.userId, staffId, presenceCode: code, expiresAt: addSeconds(new Date(), COUNTER_SESSION_TTL_SECONDS) })
    .returning();
  return s;
}

export async function getCounterSession(sessionId: string, merchantId: string, staffId: string) {
  const [s] = await db.select().from(counterSessions).where(and(eq(counterSessions.id, sessionId), eq(counterSessions.merchantId, merchantId)));
  if (!s || s.staffId !== staffId) throw badRequest('SESSION_INVALID', 'Scan the customer again');
  if (s.expiresAt < new Date()) throw badRequest('SESSION_EXPIRED', 'This scan has timed out. Scan the customer again.');
  return s;
}

export async function setCounterResult(sessionId: string, result: unknown) {
  await db.update(counterSessions).set({ lastResult: result as object }).where(eq(counterSessions.id, sessionId));
}
