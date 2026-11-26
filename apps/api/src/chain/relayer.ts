/**
 * Chain relayer: mirrors ledger_events (the outbox) to LoyaltyEscrow in strict seq order.
 * Gas is paid by the operator: customers and merchants never see it (Invisible Chain step 3).
 */
import { LoyaltyEscrowAbi, TestRupeeAbi } from '@loyallink/contracts/abi';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';
import { BaseError, ContractFunctionRevertedError, type Hex } from 'viem';
import { db } from '../db/index.js';
import { ledgerEvents, type LedgerEvent } from '../db/schema.js';
import { config } from '../config.js';
import { b32, chainStatus, getChain, type ChainCtx } from './index.js';

const ZERO32 = ('0x' + '0'.repeat(64)) as Hex;
const MAX_ATTEMPTS = 8;

type Call = { functionName: string; args: unknown[] };

function callFor(e: LedgerEvent): Call | null {
  const p = e.payload as Record<string, any>;
  const big = (n: number) => BigInt(n);
  switch (e.type) {
    case 'merchant.registered':
      return { functionName: 'registerMerchant', args: [b32(p.merchantId)] };
    case 'merchant.frozen':
      return { functionName: 'setMerchantFrozen', args: [b32(p.merchantId), !!p.frozen] };
    case 'pool.deposited':
      return { functionName: 'deposit', args: [b32(p.merchantId), big(p.amount)] };
    case 'pool.withdrawn':
      return { functionName: 'withdraw', args: [b32(p.merchantId), big(p.amount)] };
    case 'offer.published':
      return {
        functionName: 'createOffer',
        args: [b32(p.offerId), b32(p.merchantId), {
          kind: p.rewardKind === 'percent' ? 2 : 1,
          percentBps: p.rewardKind === 'percent' ? p.percentBps : 0,
          minPurchases: p.minPurchases,
          windowSecs: p.windowDays * 86400,
          validitySecs: p.rewardValidityDays * 86400,
          maxEnrolments: p.maxEnrolments,
          perCustomerLimit: p.perCustomerLimit,
          rewardValue: big(p.rewardValue),
          minTotalSpend: big(p.minTotalSpend),
          minPurchaseAmount: big(p.minPurchaseAmount),
          termsHash: p.termsHash,
        }],
      };
    case 'offer.paused':
      return { functionName: 'setOfferPaused', args: [b32(p.offerId), !!p.paused] };
    case 'offer.ended':
      return { functionName: 'endOffer', args: [b32(p.offerId)] };
    case 'enrolment.created':
      return { functionName: 'enrol', args: [b32(p.enrolmentId), b32(p.offerId), p.customerRef, big(p.at)] };
    case 'enrolment.cancelled':
      return { functionName: 'cancelEnrolment', args: [b32(p.enrolmentId), big(p.at)] };
    case 'enrolment.expired':
      return { functionName: 'expireEnrolment', args: [b32(p.enrolmentId)] };
    case 'purchase.recorded':
      return { functionName: 'recordPurchase', args: [b32(p.purchaseId), b32(p.enrolmentId), big(p.amount), big(p.at), p.rewardId ? b32(p.rewardId) : ZERO32] };
    case 'purchase.voided':
      return { functionName: 'voidPurchase', args: [b32(p.purchaseId), big(p.at)] };
    case 'reward.redeemed':
      return { functionName: 'redeem', args: [b32(p.redemptionId), b32(p.rewardId), big(p.bill), big(p.at)] };
    case 'reward.expired':
      return { functionName: 'expireReward', args: [b32(p.rewardId)] };
    default:
      return null;
  }
}

function revertName(err: unknown): string | null {
  if (err instanceof BaseError) {
    const r = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (r instanceof ContractFunctionRevertedError) return r.data?.errorName ?? r.reason ?? 'Reverted';
  }
  return null;
}

async function ensureFunds(c: ChainCtx, amount: bigint) {
  const bal = (await c.publicClient.readContract({ address: c.token, abi: TestRupeeAbi, functionName: 'balanceOf', args: [c.account.address] })) as bigint;
  if (bal < amount) {
    if (config.CHAIN_MODE !== 'local') throw new Error('Treasury has insufficient settlement balance');
    const h = await c.walletClient.writeContract({ address: c.token, abi: TestRupeeAbi, functionName: 'mint', args: [c.account.address, amount - bal], account: c.account, chain: c.walletClient.chain });
    await c.publicClient.waitForTransactionReceipt({ hash: h });
  }
  const allowance = (await c.publicClient.readContract({ address: c.token, abi: TestRupeeAbi, functionName: 'allowance', args: [c.account.address, c.escrow] })) as bigint;
  if (allowance < amount) {
    const h = await c.walletClient.writeContract({ address: c.token, abi: TestRupeeAbi, functionName: 'approve', args: [c.escrow, 2n ** 255n], account: c.account, chain: c.walletClient.chain });
    await c.publicClient.waitForTransactionReceipt({ hash: h });
  }
}

async function mark(seq: number, set: Partial<LedgerEvent>) {
  await db.update(ledgerEvents).set(set).where(eq(ledgerEvents.seq, seq));
}

/** Processes pending events in order. Returns the number handled. */
export async function relayOnce(limit = 25): Promise<number> {
  const c = getChain();
  if (!c) return 0;
  const now = new Date();
  const batch = await db
    .select()
    .from(ledgerEvents)
    .where(and(eq(ledgerEvents.chainStatus, 'pending'), or(isNull(ledgerEvents.nextAttemptAt), lte(ledgerEvents.nextAttemptAt, now))))
    .orderBy(asc(ledgerEvents.seq))
    .limit(limit);
  let handled = 0;
  for (const e of batch) {
    const call = callFor(e);
    if (!call) {
      await mark(e.seq, { chainStatus: 'skipped' });
      handled++;
      continue;
    }
    try {
      if (e.type === 'pool.deposited') await ensureFunds(c, BigInt((e.payload as { amount: number }).amount));
      const { request } = await c.publicClient.simulateContract({
        address: c.escrow, abi: LoyaltyEscrowAbi, functionName: call.functionName as never, args: call.args as never, account: c.account,
      });
      const hash = await c.walletClient.writeContract(request as never);
      const rec = await c.publicClient.waitForTransactionReceipt({ hash });
      if (rec.status !== 'success') throw new Error(`tx reverted: ${hash}`);
      await mark(e.seq, { chainStatus: 'confirmed', txHash: hash, blockNumber: Number(rec.blockNumber), error: null, attempts: e.attempts + 1 });
      chainStatus.lastError = null;
      handled++;
    } catch (err) {
      const name = revertName(err);
      if (name === 'AlreadyExists') {
        // Idempotent replay: the chain already has it.
        await mark(e.seq, { chainStatus: 'confirmed', error: 'already on chain', attempts: e.attempts + 1 });
        handled++;
        continue;
      }
      const at = (e.payload as { at?: number }).at;
      const transient = !name || (name === 'BadTimestamp' && at !== undefined && at > Date.now() / 1000 - 30) || (name === 'TooEarly');
      const attempts = e.attempts + 1;
      if (transient && attempts < MAX_ATTEMPTS) {
        const delay = Math.min(60_000, 1000 * 2 ** attempts);
        await mark(e.seq, { attempts, nextAttemptAt: new Date(Date.now() + delay), error: String(name ?? (err as Error).message).slice(0, 500) });
        chainStatus.lastError = String(name ?? (err as Error).message).slice(0, 200);
        break; // keep strict order: don't skip ahead of a transient failure
      }
      // Deterministic revert: the DB and the contract disagree. Raise a divergence alert.
      await mark(e.seq, { chainStatus: 'failed', attempts, error: `${name ?? 'error'}: ${(err as Error).message}`.slice(0, 1000) });
      chainStatus.lastError = `seq ${e.seq} ${e.type}: ${name}`;
      handled++;
    }
  }
  return handled;
}

/** Test helper: relay until nothing is pending. */
export async function relayAll(maxRounds = 50) {
  for (let i = 0; i < maxRounds; i++) {
    const n = await relayOnce(50);
    if (n === 0) return;
  }
}
