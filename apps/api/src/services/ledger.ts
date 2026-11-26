/**
 * Hash-chained public ledger + chain outbox (docs/03 §2, docs/05 "Hash chain").
 * Payloads must never contain PII: ids, amounts, timestamps and customerRef only.
 */
import { canonicalJSON } from '@loyallink/shared';
import { desc, sql } from 'drizzle-orm';
import { sha256 } from '../lib/crypto.js';
import type { Executor } from '../db/index.js';
import { ledgerEvents } from '../db/schema.js';

export const GENESIS = '0x' + '0'.repeat(64);
const LEDGER_LOCK = 7001;

/** Events that are implied by a previous on-chain call (no separate tx). */
const DERIVED = new Set(['reward.issued', 'reward.revoked', 'payout.paid', 'plan.upgraded', 'payment.received']);

export type LedgerType =
  | 'merchant.registered' | 'merchant.frozen'
  | 'pool.deposited' | 'pool.withdrawn' | 'payout.paid' | 'payment.received' | 'plan.upgraded'
  | 'offer.published' | 'offer.paused' | 'offer.ended'
  | 'enrolment.created' | 'enrolment.cancelled' | 'enrolment.expired'
  | 'purchase.recorded' | 'purchase.voided'
  | 'reward.issued' | 'reward.revoked' | 'reward.redeemed' | 'reward.expired';

export function computeHash(prevHash: string, seq: number, type: string, payload: unknown, createdAt: Date) {
  return '0x' + sha256(`${prevHash}|${seq}|${type}|${canonicalJSON(payload)}|${createdAt.toISOString()}`);
}

export interface AppendOpts {
  subjectId?: string | null;
  merchantId?: string | null;
  at?: Date;
  chain?: boolean;
}

export async function appendLedger(tx: Executor, type: LedgerType, payload: Record<string, unknown>, opts: AppendOpts = {}) {
  await tx.execute(sql`select pg_advisory_xact_lock(${LEDGER_LOCK})`);
  const [last] = await tx.select({ seq: ledgerEvents.seq, hash: ledgerEvents.hash }).from(ledgerEvents).orderBy(desc(ledgerEvents.seq)).limit(1);
  const seq = (last?.seq ?? 0) + 1;
  const prevHash = last?.hash ?? GENESIS;
  // Millisecond precision so the ISO string round-trips through Postgres exactly.
  const createdAt = new Date(Math.floor((opts.at ?? new Date()).getTime()));
  const hash = computeHash(prevHash, seq, type, payload, createdAt);
  const onChain = opts.chain !== false && !DERIVED.has(type);
  await tx.insert(ledgerEvents).values({
    seq, type, payload, prevHash, hash, createdAt,
    subjectId: opts.subjectId ?? null,
    merchantId: opts.merchantId ?? null,
    chainStatus: onChain ? 'pending' : 'skipped',
  });
  return { seq, hash };
}

export interface VerifiableEvent {
  seq: number;
  type: string;
  payload: unknown;
  prevHash: string;
  hash: string;
  createdAt: Date | string;
}

/** Recomputes the chain; returns the first broken seq or null. */
export function verifyChain(events: VerifiableEvent[], startPrev = GENESIS): number | null {
  let prev = startPrev;
  for (const e of events) {
    const h = computeHash(prev, e.seq, e.type, e.payload, new Date(e.createdAt));
    if (e.prevHash !== prev || h !== e.hash) return e.seq;
    prev = e.hash;
  }
  return null;
}
