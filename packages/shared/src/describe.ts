/** Plain-language offer text (Invisible Chain step 5: explain before they agree). */
import { formatINR, formatPercentBps } from './money.js';
import type { OfferTerms } from './rules.js';

export type Locale = 'en' | 'hi';
export const LOCALES: Locale[] = ['en', 'hi'];

type T = Pick<OfferTerms, 'minPurchases' | 'minTotalSpend' | 'minPurchaseAmount' | 'windowDays' | 'rewardKind' | 'rewardValue' | 'percentBps'>;

export function describeCondition(t: T, locale: Locale = 'en'): string {
  const n = t.minPurchases;
  const spend = formatINR(t.minTotalSpend);
  const each = t.minPurchaseAmount > 0 ? formatINR(t.minPurchaseAmount) : null;
  const days = t.windowDays;
  if (locale === 'hi') {
    let s: string;
    if (n === 1 && t.minTotalSpend > 0) s = `${days} दिनों में कुल ${spend} की खरीदारी करें`;
    else if (t.minTotalSpend > 0) s = `${days} दिनों में ${n} बार खरीदारी करें, कुल ${spend}`;
    else s = `${days} दिनों में ${n} बार खरीदारी करें`;
    if (each) s += ` (हर बिल कम से कम ${each})`;
    return s;
  }
  let s: string;
  if (n === 1 && t.minTotalSpend > 0) s = `Spend ${spend} within ${days} day${days === 1 ? '' : 's'}`;
  else if (t.minTotalSpend > 0) s = `Make ${n} purchases totalling ${spend} within ${days} days`;
  else s = `Make ${n} purchase${n === 1 ? '' : 's'} within ${days} day${days === 1 ? '' : 's'}`;
  if (each) s += ` (each bill ${each} or more)`;
  return s;
}

export function describeReward(t: Pick<T, 'rewardKind' | 'rewardValue' | 'percentBps'>, locale: Locale = 'en'): string {
  if (t.rewardKind === 'percent') {
    const pct = formatPercentBps(t.percentBps);
    const cap = formatINR(t.rewardValue);
    return locale === 'hi' ? `अगले बिल पर ${pct} छूट (अधिकतम ${cap})` : `${pct} off your next bill (up to ${cap})`;
  }
  const v = formatINR(t.rewardValue);
  return locale === 'hi' ? `${v} की छूट` : `${v} off your bills`;
}

/** Short headline for cards: "3 visits → 20% off". */
export function describeHeadline(t: T, locale: Locale = 'en'): string {
  const reward =
    t.rewardKind === 'percent'
      ? locale === 'hi'
        ? `${formatPercentBps(t.percentBps)} छूट`
        : `${formatPercentBps(t.percentBps)} off`
      : locale === 'hi'
        ? `${formatINR(t.rewardValue)} छूट`
        : `${formatINR(t.rewardValue)} off`;
  if (locale === 'hi') {
    const cond = t.minPurchases === 1 ? `${formatINR(t.minTotalSpend)} खर्च करें` : `${t.minPurchases} बार खरीदें`;
    return `${cond}, पाएं ${reward}`;
  }
  const cond = t.minPurchases === 1 ? `Spend ${formatINR(t.minTotalSpend)}` : `Buy ${t.minPurchases} times`;
  return `${cond}, get ${reward}`;
}

export function describeOffer(t: T, locale: Locale = 'en'): string {
  const arrow = locale === 'hi' ? ' → पाएं ' : ' → get ';
  return describeCondition(t, locale) + arrow + describeReward(t, locale);
}
