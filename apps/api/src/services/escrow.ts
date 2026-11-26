/**
 * Every money-affecting operation. Each function runs inside a caller-provided transaction,
 * locks the merchant row first, applies packages/shared rules, writes pool movements and
 * appends a ledger event. Mirrors LoyaltyEscrow.sol exactly.
 */
import {
  canExpireEnrolment, computeRedemption, describeReward, enrolmentDeadline, formatINR, isComplete, PLAN_LIMITS,
  progress as progressOf, purchaseQualifies, rewardExpiry, termsForHash, canonicalJSON, toUnix, fromUnix,
  validateTerms, withinDeadline, withinVoidWindow, DEFAULT_FEE_BPS, type OfferTerms, type Plan,
} from '@loyallink/shared';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { keccak256, toHex } from 'viem';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import type { Tx } from '../db/index.js';
import {
  enrolments, merchants, offers, payouts, poolMovements, purchases, redemptions, rewards, users, visits,
  type Merchant, type Offer, type Enrolment, type Reward,
} from '../db/schema.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { appendLedger } from './ledger.js';
import { notify, notifyWaitlist } from './notify.js';

type Bucket = 'external' | 'available' | 'committed' | 'owed' | 'fees';

export async function lockMerchant(tx: Tx, merchantId: string): Promise<Merchant> {
  const [m] = await tx.select().from(merchants).where(eq(merchants.id, merchantId)).for('update');
  if (!m) throw notFound('Shop not found');
  return m;
}

/** Applies a balance movement to the locked merchant row (in memory + history row). */
async function move(tx: Tx, m: Merchant, kind: string, amount: number, from: Bucket, to: Bucket, refId?: string) {
  if (amount === 0) return;
  for (const [b, sign] of [[from, -1], [to, 1]] as const) {
    if (b === 'available' || b === 'committed' || b === 'owed') {
      m[b] += sign * amount;
      if (m[b] < 0) throw new Error(`invariant: ${b} would go negative for merchant ${m.id}`);
    }
  }
  await tx.insert(poolMovements).values({ merchantId: m.id, kind, amount, fromBucket: from, toBucket: to, refId: refId ?? null });
}

async function saveBalances(tx: Tx, m: Merchant) {
  await tx.update(merchants).set({ available: m.available, committed: m.committed, owed: m.owed }).where(eq(merchants.id, m.id));
}

export const termsOf = (o: Offer): OfferTerms => ({
  minPurchases: o.minPurchases, minTotalSpend: o.minTotalSpend, minPurchaseAmount: o.minPurchaseAmount,
  windowDays: o.windowDays, rewardKind: o.rewardKind as OfferTerms['rewardKind'], rewardValue: o.rewardValue,
  percentBps: o.percentBps, rewardValidityDays: o.rewardValidityDays, maxEnrolments: o.maxEnrolments,
  perCustomerLimit: o.perCustomerLimit,
});

export const termsHashOf = (o: Offer) => keccak256(toHex(canonicalJSON(termsForHash(termsOf(o)))));

export function planOf(m: Merchant, now = new Date()): Plan {
  return m.plan === 'pro' && m.planRenewsAt && m.planRenewsAt > now ? 'pro' : 'free';
}

function assertOperational(m: Merchant) {
  if (m.status !== 'approved') throw forbidden('Your shop is waiting for verification');
  if (m.frozen) throw conflict('FROZEN', 'This shop is temporarily paused by LoyalLink support');
}

// ── pool ──────────────────────────────────────────────────────────────────
export async function depositToPool(tx: Tx, merchantId: string, amount: number, paymentId: string, now = new Date()) {
  const m = await lockMerchant(tx, merchantId);
  await move(tx, m, 'deposit', amount, 'external', 'available', paymentId);
  await saveBalances(tx, m);
  await appendLedger(tx, 'pool.deposited', { merchantId, amount, paymentId }, { subjectId: merchantId, merchantId, at: now });
  await notifyWaitlist(tx, merchantId);
  return m;
}

export function assertTopupAllowed(m: Merchant, amount: number) {
  assertOperational(m);
  const cap = PLAN_LIMITS[planOf(m)].poolCap;
  if (m.available + m.committed + amount > cap)
    throw conflict('PLAN_LIMIT', `The Free plan holds up to ${formatINR(cap)} in your pool. Upgrade to Pro for more.`);
}

export async function withdrawFromPool(tx: Tx, merchantId: string, amount: number, now = new Date()) {
  const m = await lockMerchant(tx, merchantId);
  assertOperational(m);
  if (amount <= 0) throw badRequest('INVALID_AMOUNT');
  if (m.available < amount)
    throw conflict('INSUFFICIENT_AVAILABLE', `Only ${formatINR(m.available)} is free to withdraw. Money reserved for customers stays locked until they finish or their time runs out.`);
  const [p] = await tx.insert(payouts).values({ merchantId, amount, upiId: m.upiId }).returning();
  await move(tx, m, 'withdraw', amount, 'available', 'external', p.id);
  await saveBalances(tx, m);
  await appendLedger(tx, 'pool.withdrawn', { merchantId, amount, payoutId: p.id }, { subjectId: merchantId, merchantId, at: now });
  return { merchant: m, payout: p };
}

// ── offers ────────────────────────────────────────────────────────────────
async function countLiveOffers(tx: Tx, merchantId: string, exceptId?: string) {
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(offers)
    .where(and(eq(offers.merchantId, merchantId), inArray(offers.status, ['live', 'paused']), exceptId ? ne(offers.id, exceptId) : undefined));
  return n;
}

export async function publishOffer(tx: Tx, offerId: string, now = new Date()) {
  const [o] = await tx.select().from(offers).where(eq(offers.id, offerId)).for('update');
  if (!o) throw notFound('Offer not found');
  if (o.status !== 'draft') throw conflict('NOT_DRAFT', 'Only drafts can be published');
  const m = await lockMerchant(tx, o.merchantId);
  assertOperational(m);
  const errs = validateTerms(termsOf(o));
  if (errs.length) throw badRequest('INVALID_TERMS', 'Please check the offer terms', errs);
  const limit = PLAN_LIMITS[planOf(m)].liveOffers;
  if ((await countLiveOffers(tx, m.id, o.id)) >= limit)
    throw conflict('PLAN_LIMIT', 'The Free plan runs one offer at a time. End your current offer or upgrade to Pro.');
  const feeBps = Math.min(config.FEE_BPS ?? DEFAULT_FEE_BPS, 300);
  const termsHash = termsHashOf(o);
  const [u] = await tx.update(offers).set({ status: 'live', feeBps, termsHash, publishedAt: now }).where(eq(offers.id, o.id)).returning();
  await appendLedger(tx, 'offer.published', {
    offerId: o.id, merchantId: m.id, ...termsForHash(termsOf(o)), termsHash, feeBps,
  }, { subjectId: o.id, merchantId: m.id, at: now });
  return u;
}

export async function setOfferState(tx: Tx, offerId: string, action: 'pause' | 'resume' | 'end', now = new Date()) {
  const [o] = await tx.select().from(offers).where(eq(offers.id, offerId)).for('update');
  if (!o) throw notFound('Offer not found');
  const m = await lockMerchant(tx, o.merchantId);
  if (action === 'pause') {
    if (o.status !== 'live') throw conflict('INVALID_STATE', 'Only live offers can be paused');
    await appendLedger(tx, 'offer.paused', { offerId, paused: true }, { subjectId: offerId, merchantId: m.id, at: now });
    return (await tx.update(offers).set({ status: 'paused' }).where(eq(offers.id, offerId)).returning())[0];
  }
  if (action === 'resume') {
    if (o.status !== 'paused') throw conflict('INVALID_STATE', 'Only paused offers can be resumed');
    assertOperational(m);
    await appendLedger(tx, 'offer.paused', { offerId, paused: false }, { subjectId: offerId, merchantId: m.id, at: now });
    return (await tx.update(offers).set({ status: 'live' }).where(eq(offers.id, offerId)).returning())[0];
  }
  if (o.status === 'ended') return o;
  if (o.status === 'draft') return (await tx.update(offers).set({ status: 'ended' }).where(eq(offers.id, offerId)).returning())[0];
  await appendLedger(tx, 'offer.ended', { offerId }, { subjectId: offerId, merchantId: m.id, at: now });
  return (await tx.update(offers).set({ status: 'ended' }).where(eq(offers.id, offerId)).returning())[0];
}

// ── enrolments ────────────────────────────────────────────────────────────
export async function joinOffer(tx: Tx, userId: string, offerId: string, now = new Date()) {
  const [o0] = await tx.select().from(offers).where(eq(offers.id, offerId));
  if (!o0) throw notFound('Offer not found');
  const m = await lockMerchant(tx, o0.merchantId); // lock order: merchant, then offer
  const [o] = await tx.select().from(offers).where(eq(offers.id, offerId)).for('update');
  const [u] = await tx.select().from(users).where(eq(users.id, userId));
  if (!u || u.deletedAt) throw notFound('Account not found');
  if (o.status !== 'live') throw conflict('OFFER_CLOSED', 'This offer is not taking new customers right now');
  if (m.frozen) throw conflict('OFFER_CLOSED', 'This shop is temporarily paused');
  const mine = await tx.select().from(enrolments).where(and(eq(enrolments.offerId, o.id), eq(enrolments.userId, userId)));
  if (mine.some((e) => e.status === 'active')) throw conflict('ALREADY_JOINED', 'You have already joined this offer');
  if (mine.filter((e) => e.status === 'completed').length >= o.perCustomerLimit)
    throw conflict('CUSTOMER_LIMIT', 'You have already earned this reward the maximum number of times');
  if (o.enrolled >= o.maxEnrolments) throw conflict('POOL_FULL', 'All spots are taken. Join the waitlist and we will tell you when one opens.');
  if (m.available < o.rewardValue) throw conflict('POOL_FULL', 'All funded spots are taken. Join the waitlist and we will tell you when one opens.');

  const id = randomUUID();
  const startedAt = new Date(Math.floor(now.getTime() / 1000) * 1000);
  const deadline = fromUnix(enrolmentDeadline(toUnix(startedAt), o.windowDays));
  await move(tx, m, 'reserve', o.rewardValue, 'available', 'committed', id);
  await saveBalances(tx, m);
  await tx.update(offers).set({ enrolled: o.enrolled + 1 }).where(eq(offers.id, o.id));
  const [e] = await tx.insert(enrolments).values({ id, offerId: o.id, merchantId: m.id, userId, startedAt, deadline }).returning();
  await appendLedger(tx, 'enrolment.created', {
    enrolmentId: id, offerId: o.id, merchantId: m.id, customerRef: u.customerRef, reserved: o.rewardValue,
    at: toUnix(startedAt), deadline: toUnix(deadline),
  }, { subjectId: id, merchantId: m.id, at: now });
  return e;
}

async function releaseEnrolment(tx: Tx, m: Merchant, e: Enrolment, status: 'expired' | 'cancelled', now: Date) {
  const [o] = await tx.select().from(offers).where(eq(offers.id, e.offerId)).for('update');
  await move(tx, m, status === 'expired' ? 'release_expired' : 'release_cancelled', o.rewardValue, 'committed', 'available', e.id);
  await saveBalances(tx, m);
  await tx.update(offers).set({ enrolled: o.enrolled - 1 }).where(eq(offers.id, o.id));
  await tx.update(enrolments).set({ status, closedAt: now }).where(eq(enrolments.id, e.id));
  return o;
}

export async function cancelEnrolment(tx: Tx, userId: string, enrolmentId: string, now = new Date()) {
  const [e0] = await tx.select().from(enrolments).where(eq(enrolments.id, enrolmentId));
  if (!e0 || e0.userId !== userId) throw notFound('Not found');
  const m = await lockMerchant(tx, e0.merchantId);
  const [e] = await tx.select().from(enrolments).where(eq(enrolments.id, enrolmentId)).for('update');
  if (e.status !== 'active') throw conflict('NOT_ACTIVE', 'This offer is no longer active');
  await releaseEnrolment(tx, m, e, 'cancelled', now);
  await appendLedger(tx, 'enrolment.cancelled', { enrolmentId, at: toUnix(now) }, { subjectId: enrolmentId, merchantId: m.id, at: now });
  await notifyWaitlist(tx, m.id);
}

export async function expireEnrolment(tx: Tx, enrolmentId: string, now = new Date()) {
  const [e0] = await tx.select().from(enrolments).where(eq(enrolments.id, enrolmentId));
  if (!e0) return false;
  const m = await lockMerchant(tx, e0.merchantId);
  const [e] = await tx.select().from(enrolments).where(eq(enrolments.id, enrolmentId)).for('update');
  if (e.status !== 'active' || !canExpireEnrolment(toUnix(e.deadline), toUnix(now))) return false;
  const o = await releaseEnrolment(tx, m, e, 'expired', now);
  await appendLedger(tx, 'enrolment.expired', { enrolmentId }, { subjectId: enrolmentId, merchantId: m.id, at: now });
  const [u] = await tx.select().from(users).where(eq(users.id, e.userId));
  await notify(tx, {
    userId: e.userId, kind: 'expired',
    title: u?.locale === 'hi' ? 'ऑफ़र का समय खत्म' : 'Offer time ended',
    body: u?.locale === 'hi' ? `"${o.title}" का समय पूरा हो गया। आप फिर से शामिल हो सकते हैं।` : `Time ran out on "${o.title}". You can join again any time.`,
    link: `/offer/${o.id}`, dedupeKey: `expired:${e.id}`,
  });
  await notifyWaitlist(tx, m.id);
  return true;
}

// ── counter: purchases ────────────────────────────────────────────────────
export interface PurchaseOutcome {
  enrolmentId: string;
  offerId: string;
  offerTitle: string;
  counted: boolean;
  reason?: 'below_minimum' | 'deadline_passed';
  purchases: number;
  spend: number;
  minPurchases: number;
  minTotalSpend: number;
  completed: boolean;
  rewardId?: string;
  rewardText?: string;
}

export async function recordVisit(tx: Tx, merchantId: string, userId: string, staffId: string, amount: number, now = new Date()) {
  if (!Number.isInteger(amount) || amount <= 0) throw badRequest('INVALID_AMOUNT', 'Enter the bill amount');
  const m = await lockMerchant(tx, merchantId);
  const at = new Date(Math.floor(now.getTime() / 1000) * 1000);
  const [u] = await tx.select().from(users).where(eq(users.id, userId));
  const [visit] = await tx.insert(visits).values({ merchantId, userId, staffId, amount, createdAt: at }).returning();
  const active = await tx
    .select()
    .from(enrolments)
    .where(and(eq(enrolments.merchantId, merchantId), eq(enrolments.userId, userId), eq(enrolments.status, 'active')))
    .for('update');
  const outcomes: PurchaseOutcome[] = [];
  let dirty = false;
  for (const e of active) {
    const [o] = await tx.select().from(offers).where(eq(offers.id, e.offerId));
    const t = termsOf(o);
    const base = { enrolmentId: e.id, offerId: o.id, offerTitle: o.title, minPurchases: o.minPurchases, minTotalSpend: o.minTotalSpend };
    if (!withinDeadline(toUnix(e.deadline), toUnix(at))) {
      outcomes.push({ ...base, counted: false, reason: 'deadline_passed', purchases: e.purchases, spend: e.spend, completed: false });
      continue;
    }
    if (!purchaseQualifies(t, amount)) {
      outcomes.push({ ...base, counted: false, reason: 'below_minimum', purchases: e.purchases, spend: e.spend, completed: false });
      continue;
    }
    const purchaseId = randomUUID();
    const nPurchases = e.purchases + 1;
    const nSpend = e.spend + amount;
    const done = isComplete(t, nPurchases, nSpend);
    const rewardId = done ? randomUUID() : null;
    await tx.insert(purchases).values({ id: purchaseId, visitId: visit.id, enrolmentId: e.id, amount, at });
    await appendLedger(tx, 'purchase.recorded', {
      purchaseId, enrolmentId: e.id, visitId: visit.id, amount, at: toUnix(at), rewardId,
    }, { subjectId: e.id, merchantId, at: now });
    const before = progressOf(t, e.purchases, e.spend).overall;
    const after = progressOf(t, nPurchases, nSpend).overall;
    if (done && rewardId) {
      const expiresAt = fromUnix(rewardExpiry(toUnix(at), o.rewardValidityDays));
      await tx.insert(rewards).values({
        id: rewardId, merchantId, userId, offerId: o.id, enrolmentId: e.id, kind: o.rewardKind, percentBps: o.percentBps,
        feeBps: o.feeBps, value: o.rewardValue, remaining: o.rewardValue, issuedAt: at, expiresAt,
      });
      await move(tx, m, 'issue', o.rewardValue, 'committed', 'owed', rewardId);
      dirty = true;
      await tx.update(enrolments).set({ purchases: nPurchases, spend: nSpend, status: 'completed', closedAt: at, rewardId }).where(eq(enrolments.id, e.id));
      await appendLedger(tx, 'reward.issued', {
        rewardId, enrolmentId: e.id, customerRef: u.customerRef, value: o.rewardValue, expiresAt: toUnix(expiresAt),
      }, { subjectId: rewardId, merchantId, at: now });
      const text = describeReward(t, (u.locale as 'en' | 'hi') ?? 'en');
      await notify(tx, {
        userId, kind: 'reward', link: `/rewards`, dedupeKey: `reward:${rewardId}`,
        title: u.locale === 'hi' ? `🎉 इनाम मिल गया: ${m.name}` : `🎉 Reward unlocked at ${m.name}`,
        body: u.locale === 'hi' ? `${text}। अगली बार काउंटर पर QR दिखाएँ।` : `${text}. Show your QR at the counter to use it.`,
      });
      outcomes.push({ ...base, counted: true, purchases: nPurchases, spend: nSpend, completed: true, rewardId, rewardText: describeReward(t) });
    } else {
      await tx.update(enrolments).set({ purchases: nPurchases, spend: nSpend }).where(eq(enrolments.id, e.id));
      for (const mark of [0.5, 0.75]) {
        if (before < mark && after >= mark) {
          const pct = Math.round(mark * 100);
          await notify(tx, {
            userId, kind: 'progress', link: `/progress/${e.id}`, dedupeKey: `progress:${e.id}:${pct}`,
            title: u.locale === 'hi' ? `${pct}% पूरा: ${m.name}` : `${pct}% there at ${m.name}`,
            body: u.locale === 'hi' ? `"${o.title}". बस थोड़ा और!` : `"${o.title}". Keep going!`,
          });
        }
      }
      outcomes.push({ ...base, counted: true, purchases: nPurchases, spend: nSpend, completed: false });
    }
  }
  if (dirty) await saveBalances(tx, m);
  return { visit, outcomes };
}

export async function voidVisit(tx: Tx, merchantId: string, visitId: string, now = new Date()) {
  const m = await lockMerchant(tx, merchantId);
  const [v] = await tx.select().from(visits).where(and(eq(visits.id, visitId), eq(visits.merchantId, merchantId))).for('update');
  if (!v) throw notFound('Visit not found');
  if (v.voidedAt) throw conflict('ALREADY_VOIDED', 'This purchase was already voided');
  if (!withinVoidWindow(toUnix(v.createdAt), toUnix(now)))
    throw conflict('WINDOW_CLOSED', 'Purchases can only be voided within 24 hours');
  const ps = await tx.select().from(purchases).where(and(eq(purchases.visitId, v.id), eq(purchases.voided, false))).for('update');

  // Pre-check: a used reward can never be revoked (R3).
  const plan: { p: typeof ps[number]; e: Enrolment; o: Offer; r?: Reward; uncomplete: boolean }[] = [];
  for (const p of ps) {
    const [e] = await tx.select().from(enrolments).where(eq(enrolments.id, p.enrolmentId)).for('update');
    const [o] = await tx.select().from(offers).where(eq(offers.id, e.offerId)).for('update');
    let r: Reward | undefined;
    let uncomplete = false;
    if (e.status === 'completed' && e.rewardId) {
      [r] = await tx.select().from(rewards).where(eq(rewards.id, e.rewardId)).for('update');
      if (r.status !== 'active' || r.remaining !== r.value)
        throw conflict('REWARD_USED', 'This purchase unlocked a reward that has already been used, so it can no longer be voided');
      uncomplete = !isComplete(termsOf(o), e.purchases - 1, e.spend - p.amount);
    }
    plan.push({ p, e, o, r, uncomplete });
  }

  for (const { p, e, o, r, uncomplete } of plan) {
    await tx.update(purchases).set({ voided: true }).where(eq(purchases.id, p.id));
    const nP = e.purchases - 1;
    const nS = e.spend - p.amount;
    let outcome: 'progress' | 'reactivated' | 'closed' = 'progress';
    if (r && uncomplete) {
      await tx.update(rewards).set({ status: 'revoked', remaining: 0 }).where(eq(rewards.id, r.id));
      const [slot] = await tx.select({ id: enrolments.id }).from(enrolments)
        .where(and(eq(enrolments.offerId, o.id), eq(enrolments.userId, e.userId), eq(enrolments.status, 'active')));
      if (slot || !withinDeadline(toUnix(e.deadline), toUnix(now))) {
        await move(tx, m, 'revoke_release', r.value, 'owed', 'available', r.id);
        await tx.update(offers).set({ enrolled: o.enrolled - 1 }).where(eq(offers.id, o.id));
        await tx.update(enrolments).set({ purchases: nP, spend: nS, status: 'expired', rewardId: null, closedAt: now }).where(eq(enrolments.id, e.id));
        outcome = 'closed';
      } else {
        await move(tx, m, 'revoke', r.value, 'owed', 'committed', r.id);
        await tx.update(enrolments).set({ purchases: nP, spend: nS, status: 'active', rewardId: null, closedAt: null }).where(eq(enrolments.id, e.id));
        outcome = 'reactivated';
      }
      await appendLedger(tx, 'purchase.voided', { purchaseId: p.id, at: toUnix(now) }, { subjectId: e.id, merchantId, at: now });
      await appendLedger(tx, 'reward.revoked', { rewardId: r.id, outcome }, { subjectId: r.id, merchantId, at: now });
    } else {
      await tx.update(enrolments).set({ purchases: nP, spend: nS }).where(eq(enrolments.id, e.id));
      await appendLedger(tx, 'purchase.voided', { purchaseId: p.id, at: toUnix(now) }, { subjectId: e.id, merchantId, at: now });
    }
  }
  await saveBalances(tx, m);
  await tx.update(visits).set({ voidedAt: now }).where(eq(visits.id, v.id));
  return { voided: plan.length };
}

// ── counter: redemption ───────────────────────────────────────────────────
export async function redeemReward(tx: Tx, merchantId: string, userId: string, staffId: string, rewardId: string, bill: number, now = new Date()) {
  const m = await lockMerchant(tx, merchantId);
  const [r] = await tx.select().from(rewards).where(eq(rewards.id, rewardId)).for('update');
  if (!r || r.userId !== userId || r.merchantId !== merchantId) throw notFound('Reward not found for this customer');
  if (r.status !== 'active') throw conflict('REWARD_NOT_ACTIVE', 'This reward has already been used');
  if (now > r.expiresAt) throw conflict('REWARD_EXPIRED', 'This reward has expired');
  const res = computeRedemption({ kind: r.kind as 'credit' | 'percent', percentBps: r.percentBps, value: r.value, remaining: r.remaining, feeBps: r.feeBps }, bill);
  const id = randomUUID();
  await tx.update(rewards).set({ remaining: res.remainingAfter, status: res.remainingAfter === 0 ? 'used' : 'active' }).where(eq(rewards.id, r.id));
  await move(tx, m, 'redeem_reimburse', res.reimbursed, 'owed', 'available', id);
  await move(tx, m, 'redeem_fee', res.fee, 'owed', 'fees', id);
  await move(tx, m, 'redeem_return', res.returned, 'owed', 'available', id);
  await saveBalances(tx, m);
  const [red] = await tx.insert(redemptions).values({
    id, rewardId: r.id, merchantId, userId, staffId, billAmount: bill, used: res.used, fee: res.fee, returned: res.returned,
  }).returning();
  await appendLedger(tx, 'reward.redeemed', {
    redemptionId: id, rewardId: r.id, bill, used: res.used, fee: res.fee, returned: res.returned, at: toUnix(now),
  }, { subjectId: r.id, merchantId, at: now });
  return { redemption: red, ...res };
}

export async function expireReward(tx: Tx, rewardId: string, now = new Date()) {
  const [r0] = await tx.select().from(rewards).where(eq(rewards.id, rewardId));
  if (!r0) return false;
  const m = await lockMerchant(tx, r0.merchantId);
  const [r] = await tx.select().from(rewards).where(eq(rewards.id, rewardId)).for('update');
  if (r.status !== 'active' || now <= r.expiresAt) return false;
  await move(tx, m, 'reward_expired', r.remaining, 'owed', 'available', r.id);
  await saveBalances(tx, m);
  await tx.update(rewards).set({ status: 'expired' }).where(eq(rewards.id, r.id));
  await appendLedger(tx, 'reward.expired', { rewardId: r.id, returned: r.remaining }, { subjectId: r.id, merchantId: m.id, at: now });
  await notifyWaitlist(tx, m.id);
  return true;
}
