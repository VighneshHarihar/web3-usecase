import { describe, expect, it } from 'vitest';
import {
  canonicalJSON, computeRedemption, describeOffer, enrolmentDeadline, findBannedWords, formatINR, isComplete,
  normalizePhone, parseRupees, progress, purchaseQualifies, rupees, uuidToBytes32, bytes32ToUuid, validateTerms,
  withinDeadline, withinVoidWindow, type OfferTerms,
} from '../src/index.js';

const sharma: OfferTerms = {
  minPurchases: 3, minTotalSpend: rupees(1500), minPurchaseAmount: rupees(200), windowDays: 30,
  rewardKind: 'percent', rewardValue: rupees(300), percentBps: 2000, rewardValidityDays: 60,
  maxEnrolments: 100, perCustomerLimit: 1,
};

describe('money', () => {
  it('formats INR with Indian grouping', () => {
    expect(formatINR(150000)).toBe('₹1,500');
    expect(formatINR(23520)).toBe('₹235.20');
    expect(formatINR(1234567_00)).toBe('₹12,34,567');
  });
  it('parses rupee input', () => {
    expect(parseRupees('1,500')).toBe(150000);
    expect(parseRupees('₹ 99.5')).toBe(9950);
    expect(parseRupees('abc')).toBeNull();
    expect(parseRupees('1.234')).toBeNull();
  });
});

describe('terms validation', () => {
  it('accepts the worked example', () => expect(validateTerms(sharma)).toEqual([]));
  it('rejects expiry weaponisation (validity < 30 days)', () =>
    expect(validateTerms({ ...sharma, rewardValidityDays: 7 })).toContain('rewardValidityDays'));
  it('rejects bad percent', () => expect(validateTerms({ ...sharma, percentBps: 0 })).toContain('percentBps'));
});

describe('progress & completion (worked example)', () => {
  it('counts bills ≥ minimum only', () => {
    expect(purchaseQualifies(sharma, rupees(199))).toBe(false);
    expect(purchaseQualifies(sharma, rupees(200))).toBe(true);
  });
  it('completes on 3 bills totalling ₹1,570', () => {
    expect(isComplete(sharma, 2, rupees(1050))).toBe(false);
    expect(isComplete(sharma, 3, rupees(1570))).toBe(true);
    expect(isComplete(sharma, 3, rupees(1499))).toBe(false); // count met, spend not
  });
  it('reports progress as the min of both conditions', () => {
    const p = progress(sharma, 3, rupees(750));
    expect(p.purchases).toBe(1);
    expect(p.overall).toBe(0.5);
    expect(p.spendLeft).toBe(rupees(750));
  });
});

describe('time rules', () => {
  const start = 1_800_000_000;
  const deadline = enrolmentDeadline(start, 30);
  it('applies the 60 s grace for last-second purchases', () => {
    expect(withinDeadline(deadline, deadline + 30)).toBe(true);
    expect(withinDeadline(deadline, deadline + 61)).toBe(false);
  });
  it('void window is 24 h', () => {
    expect(withinVoidWindow(start, start + 86_400)).toBe(true);
    expect(withinVoidWindow(start, start + 86_401)).toBe(false);
  });
});

describe('redemption math', () => {
  it('percent coupon: 20% of ₹1,200 = ₹240, fee 2%, ₹60 of cap returned', () => {
    const r = computeRedemption({ kind: 'percent', percentBps: 2000, value: 30000, remaining: 30000, feeBps: 200 }, 120000);
    expect(r).toEqual({ used: 24000, fee: 480, reimbursed: 23520, returned: 6000, remainingAfter: 0, payable: 96000 });
  });
  it('percent coupon is capped', () => {
    const r = computeRedemption({ kind: 'percent', percentBps: 2000, value: 30000, remaining: 30000, feeBps: 200 }, 500000);
    expect(r.used).toBe(30000);
    expect(r.returned).toBe(0);
  });
  it('credit can be used partially', () => {
    const r = computeRedemption({ kind: 'credit', percentBps: 0, value: 45000, remaining: 45000, feeBps: 200 }, 12000);
    expect(r.used).toBe(12000);
    expect(r.remainingAfter).toBe(33000);
    expect(r.fee).toBe(240);
  });
  it('conserves money', () => {
    for (let i = 0; i < 500; i++) {
      const value = 100 + Math.floor(Math.random() * 100000);
      const kind = Math.random() < 0.5 ? 'credit' : 'percent';
      const st = { kind, percentBps: 1 + Math.floor(Math.random() * 10000), value, remaining: value, feeBps: Math.floor(Math.random() * 301) } as const;
      const bill = 1 + Math.floor(Math.random() * 200000);
      const r = computeRedemption(st, bill);
      expect(r.used + r.returned + r.remainingAfter).toBe(value);
      expect(r.fee + r.reimbursed).toBe(r.used);
      expect(r.used).toBeLessThanOrEqual(bill);
    }
  });
});

describe('describe', () => {
  it('renders the plain sentence', () => {
    expect(describeOffer(sharma)).toBe(
      'Make 3 purchases totalling ₹1,500 within 30 days (each bill ₹200 or more) → get 20% off your next bill (up to ₹300)',
    );
    expect(describeOffer(sharma, 'hi')).toContain('अधिकतम ₹300');
  });
});

describe('misc', () => {
  it('normalises Indian phone numbers', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('+91-98765-43210')).toBe('+919876543210');
    expect(normalizePhone('09876543210')).toBe('+919876543210');
    expect(normalizePhone('12345')).toBeNull();
  });
  it('round-trips uuid ⇄ bytes32', () => {
    const u = '3f2b8c1e-9a4d-4e5f-8a6b-7c8d9e0f1a2b';
    expect(uuidToBytes32(u)).toHaveLength(66);
    expect(bytes32ToUuid(uuidToBytes32(u))).toBe(u);
  });
  it('canonical JSON sorts keys', () => expect(canonicalJSON({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}'));
  it('detects banned words', () => {
    expect(findBannedWords('Your wallet balance')).toEqual(['wallet']);
    expect(findBannedWords('Reward secured for you')).toEqual([]);
    expect(findBannedWords('Gastronomy')).toEqual([]);
  });
});
