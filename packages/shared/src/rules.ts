/**
 * Canonical offer rules. Mirrored exactly by packages/contracts/contracts/LoyaltyEscrow.sol.
 * Any change here MUST be reflected there (and vice versa). See docs/02-PRODUCT-SPEC-v1.md §2.
 */
import { bpsOf, type Paise } from './money.js';

export const GRACE_SECONDS = 60;
export const VOID_WINDOW_SECONDS = 24 * 60 * 60;
export const MIN_REWARD_VALIDITY_DAYS = 30;
export const MAX_REWARD_VALIDITY_DAYS = 365;
export const MAX_WINDOW_DAYS = 365;
export const MAX_FEE_BPS = 300;
export const DEFAULT_FEE_BPS = 200;
export const PRESENCE_TTL_SECONDS = 120;
export const COUNTER_SESSION_TTL_SECONDS = 300;

export const PLAN_LIMITS = {
  free: { liveOffers: 1, poolCap: 10_000_00, staff: 0, csvExport: false },
  pro: { liveOffers: Infinity, poolCap: Infinity, staff: 10, csvExport: true },
} as const;
export type Plan = keyof typeof PLAN_LIMITS;
export const PRO_PRICE_PAISE = 999_00;
export const PRO_PERIOD_DAYS = 30;

export type RewardKind = 'credit' | 'percent';

export interface OfferTerms {
  minPurchases: number;
  minTotalSpend: Paise;
  minPurchaseAmount: Paise;
  windowDays: number;
  rewardKind: RewardKind;
  /** credit: amount; percent: the cap. This is what gets escrowed per customer. */
  rewardValue: Paise;
  /** percent only, 1..10000 */
  percentBps: number;
  rewardValidityDays: number;
  maxEnrolments: number;
  perCustomerLimit: number;
}

export type TermsError =
  | 'minPurchases' | 'minTotalSpend' | 'minPurchaseAmount' | 'windowDays' | 'rewardValue'
  | 'percentBps' | 'rewardValidityDays' | 'maxEnrolments' | 'perCustomerLimit' | 'unreachable';

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function validateTerms(t: OfferTerms): TermsError[] {
  const e: TermsError[] = [];
  if (!isInt(t.minPurchases) || t.minPurchases < 1 || t.minPurchases > 1000) e.push('minPurchases');
  if (!isInt(t.minTotalSpend) || t.minTotalSpend < 0) e.push('minTotalSpend');
  if (!isInt(t.minPurchaseAmount) || t.minPurchaseAmount < 0) e.push('minPurchaseAmount');
  if (!isInt(t.windowDays) || t.windowDays < 1 || t.windowDays > MAX_WINDOW_DAYS) e.push('windowDays');
  if (!isInt(t.rewardValue) || t.rewardValue < 100) e.push('rewardValue');
  if (t.rewardKind === 'percent') {
    if (!isInt(t.percentBps) || t.percentBps < 1 || t.percentBps > 10_000) e.push('percentBps');
  } else if (t.rewardKind !== 'credit') e.push('rewardValue');
  if (!isInt(t.rewardValidityDays) || t.rewardValidityDays < MIN_REWARD_VALIDITY_DAYS || t.rewardValidityDays > MAX_REWARD_VALIDITY_DAYS)
    e.push('rewardValidityDays');
  if (!isInt(t.maxEnrolments) || t.maxEnrolments < 1 || t.maxEnrolments > 1_000_000) e.push('maxEnrolments');
  if (!isInt(t.perCustomerLimit) || t.perCustomerLimit < 1 || t.perCustomerLimit > 100) e.push('perCustomerLimit');
  return e;
}

export const DAY = 86_400;
export const toUnix = (d: Date) => Math.floor(d.getTime() / 1000);
export const fromUnix = (s: number) => new Date(s * 1000);

/** Deadline in unix seconds. */
export function enrolmentDeadline(startedAtUnix: number, windowDays: number): number {
  return startedAtUnix + windowDays * DAY;
}
export function rewardExpiry(issuedAtUnix: number, validityDays: number): number {
  return issuedAtUnix + validityDays * DAY;
}
export function withinDeadline(deadlineUnix: number, atUnix: number): boolean {
  return atUnix <= deadlineUnix + GRACE_SECONDS;
}
export function canExpireEnrolment(deadlineUnix: number, nowUnix: number): boolean {
  return nowUnix > deadlineUnix + GRACE_SECONDS;
}
export function withinVoidWindow(purchaseAtUnix: number, atUnix: number): boolean {
  return atUnix <= purchaseAtUnix + VOID_WINDOW_SECONDS;
}

export function purchaseQualifies(t: Pick<OfferTerms, 'minPurchaseAmount'>, amount: Paise): boolean {
  return amount > 0 && amount >= t.minPurchaseAmount;
}

export function isComplete(t: Pick<OfferTerms, 'minPurchases' | 'minTotalSpend'>, purchases: number, spend: Paise): boolean {
  return purchases >= t.minPurchases && spend >= t.minTotalSpend;
}

/** 0..1 progress for each condition, and the overall progress (the min of the two). */
export function progress(t: Pick<OfferTerms, 'minPurchases' | 'minTotalSpend'>, purchases: number, spend: Paise) {
  const p = Math.min(1, purchases / t.minPurchases);
  const s = t.minTotalSpend > 0 ? Math.min(1, spend / t.minTotalSpend) : 1;
  return {
    purchases: p,
    spend: s,
    overall: Math.min(p, s),
    purchasesLeft: Math.max(0, t.minPurchases - purchases),
    spendLeft: Math.max(0, t.minTotalSpend - spend),
  };
}

export interface RewardState {
  kind: RewardKind;
  percentBps: number;
  value: Paise;
  remaining: Paise;
  feeBps: number;
}

export interface RedemptionResult {
  /** Discount the customer receives on this bill. */
  used: Paise;
  /** Platform fee taken from the merchant's reimbursement. */
  fee: Paise;
  /** Credited to the merchant's available pool (used − fee). */
  reimbursed: Paise;
  /** Unused cap (percent coupons) returned to the merchant's available pool. */
  returned: Paise;
  remainingAfter: Paise;
  /** What the customer pays. */
  payable: Paise;
}

export function computeRedemption(r: RewardState, bill: Paise): RedemptionResult {
  if (!isInt(bill) || bill <= 0) throw new Error('bill must be a positive integer');
  if (r.remaining <= 0) throw new Error('reward has no remaining value');
  let used: Paise;
  let returned = 0;
  let remainingAfter: Paise;
  if (r.kind === 'credit') {
    used = Math.min(r.remaining, bill);
    remainingAfter = r.remaining - used;
  } else {
    used = Math.min(bpsOf(bill, r.percentBps), r.remaining);
    returned = r.remaining - used;
    remainingAfter = 0;
  }
  const fee = bpsOf(used, r.feeBps);
  return { used, fee, reimbursed: used - fee, returned, remainingAfter, payable: bill - used };
}

/** Deterministic JSON (sorted keys) for termsHash. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`)
    .join(',')}}`;
}

export function termsForHash(t: OfferTerms) {
  return {
    v: 1,
    minPurchases: t.minPurchases,
    minTotalSpend: t.minTotalSpend,
    minPurchaseAmount: t.minPurchaseAmount,
    windowDays: t.windowDays,
    rewardKind: t.rewardKind,
    rewardValue: t.rewardValue,
    percentBps: t.rewardKind === 'percent' ? t.percentBps : 0,
    rewardValidityDays: t.rewardValidityDays,
    maxEnrolments: t.maxEnrolments,
    perCustomerLimit: t.perCustomerLimit,
  };
}

/** The amount that must be in the pool to serve `customers` enrolments. */
export function requiredPool(t: Pick<OfferTerms, 'rewardValue'>, customers: number): Paise {
  return t.rewardValue * customers;
}
