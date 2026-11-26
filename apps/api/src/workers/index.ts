/**
 * Background workers. Only one API instance runs them at a time (Postgres advisory lock),
 * so we need no Redis or queue (ADR-04).
 */
import type { PoolClient } from 'pg';
import { and, eq, gt, isNull, lt, lte } from 'drizzle-orm';
import { GRACE_SECONDS } from '@loyallink/shared';
import type { FastifyBaseLogger } from 'fastify';
import { config } from '../config.js';
import { db, pool } from '../db/index.js';
import { counterSessions, enrolments, merchants, offers, otpCodes, presenceCodes, rewards, sessions, users } from '../db/schema.js';
import { expireEnrolment, expireReward } from '../services/escrow.js';
import { notify } from '../services/notify.js';
import { relayOnce } from '../chain/relayer.js';
import { getChain } from '../chain/index.js';
import { formatINR } from '@loyallink/shared';

const LEADER_LOCK = 7002;

export async function sweepOnce(now = new Date()) {
  const grace = new Date(now.getTime() - GRACE_SECONDS * 1000);
  const due = await db.select({ id: enrolments.id }).from(enrolments).where(and(eq(enrolments.status, 'active'), lt(enrolments.deadline, grace))).limit(200);
  for (const e of due) await db.transaction((tx) => expireEnrolment(tx, e.id, now));

  const dueRewards = await db.select({ id: rewards.id }).from(rewards).where(and(eq(rewards.status, 'active'), lt(rewards.expiresAt, now))).limit(200);
  for (const r of dueRewards) await db.transaction((tx) => expireReward(tx, r.id, now));

  // Reminders: enrolment ends within 24 h
  const soon = new Date(now.getTime() + 24 * 3600_000);
  const ending = await db
    .select({ e: enrolments, title: offers.title, shop: merchants.name, locale: users.locale })
    .from(enrolments)
    .innerJoin(offers, eq(offers.id, enrolments.offerId))
    .innerJoin(merchants, eq(merchants.id, enrolments.merchantId))
    .innerJoin(users, eq(users.id, enrolments.userId))
    .where(and(eq(enrolments.status, 'active'), lte(enrolments.deadline, soon), gt(enrolments.deadline, now), isNull(enrolments.remindedAt)))
    .limit(200);
  for (const { e, title, shop, locale } of ending) {
    await notify(db, {
      userId: e.userId, kind: 'ending', link: `/progress/${e.id}`, dedupeKey: `ending:${e.id}`,
      title: locale === 'hi' ? `कल खत्म: ${shop}` : `Ends within a day at ${shop}`,
      body: locale === 'hi' ? `"${title}" पूरा करने का समय कम है।` : `Last chance to finish "${title}".`,
    });
    await db.update(enrolments).set({ remindedAt: now }).where(eq(enrolments.id, e.id));
  }

  // Reminders: reward expiring in 7 days / 1 day
  for (const days of [7, 1]) {
    const edge = new Date(now.getTime() + days * 86_400_000);
    const exp = await db
      .select({ r: rewards, shop: merchants.name, locale: users.locale })
      .from(rewards)
      .innerJoin(merchants, eq(merchants.id, rewards.merchantId))
      .innerJoin(users, eq(users.id, rewards.userId))
      .where(and(eq(rewards.status, 'active'), lte(rewards.expiresAt, edge), gt(rewards.expiresAt, now)))
      .limit(200);
    for (const { r, shop, locale } of exp) {
      if (r.remindedDays !== null && r.remindedDays <= days) continue;
      await notify(db, {
        userId: r.userId, kind: 'reward_expiring', link: '/rewards', dedupeKey: `rexp:${r.id}:${days}`,
        title: locale === 'hi' ? `${shop} का इनाम जल्द खत्म होगा` : `Use your ${shop} reward soon`,
        body: locale === 'hi' ? `${formatINR(r.remaining)} तक की छूट ${days} दिन में खत्म होगी।` : `Up to ${formatINR(r.remaining)} off expires in ${days} day${days > 1 ? 's' : ''}.`,
      });
      await db.update(rewards).set({ remindedDays: days }).where(eq(rewards.id, r.id));
    }
  }

  // Housekeeping (always real time)
  const real = new Date();
  await db.delete(otpCodes).where(lt(otpCodes.expiresAt, new Date(real.getTime() - 86_400_000)));
  await db.delete(presenceCodes).where(lt(presenceCodes.expiresAt, real));
  await db.delete(counterSessions).where(lt(counterSessions.expiresAt, new Date(real.getTime() - 86_400_000)));
  await db.delete(sessions).where(lt(sessions.expiresAt, real));
  return { expiredEnrolments: due.length, expiredRewards: dueRewards.length };
}

export function startWorkers(log: FastifyBaseLogger) {
  let stopped = false;
  let leaderClient: PoolClient | null = null;
  let isLeader = false;

  let pending: Promise<boolean> | null = null;
  // One connection holds the session-level advisory lock; concurrent callers share one attempt.
  function tryLead(): Promise<boolean> {
    if (isLeader) return Promise.resolve(true);
    pending ??= (async () => {
      try {
        leaderClient ??= await pool.connect();
        const r = await leaderClient.query('select pg_try_advisory_lock($1) as ok', [LEADER_LOCK]);
        isLeader = !!r.rows[0]?.ok;
        if (isLeader) log.info('workers: this instance is the leader');
      } catch (e) {
        log.error(e, 'workers: leader check failed');
        leaderClient?.release(true);
        leaderClient = null;
      } finally {
        pending = null;
      }
      return isLeader;
    })();
    return pending;
  }

  async function loop(name: string, every: number, fn: () => Promise<unknown>) {
    while (!stopped) {
      try {
        if (await tryLead()) await fn();
      } catch (e) {
        log.error({ err: e }, `worker ${name} failed`);
      }
      await new Promise((r) => setTimeout(r, every));
    }
  }

  void loop('sweeper', config.SWEEPER_INTERVAL_MS, () => sweepOnce());
  if (getChain()) void loop('relayer', config.RELAYER_INTERVAL_MS, () => relayOnce());

  return async () => {
    stopped = true;
    if (leaderClient) {
      await leaderClient.query('select pg_advisory_unlock_all()').catch(() => undefined);
      leaderClient.release();
    }
  };
}

