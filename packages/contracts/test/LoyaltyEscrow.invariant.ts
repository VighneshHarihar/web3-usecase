import assert from 'node:assert/strict';
import type { Hex } from 'viem';
import { DAY, deploy, id, increase, Kind, now, offerParams } from './helpers';

/**
 * Randomized sequence test of the solvency invariants (docs/04-SMART-CONTRACT.md):
 *  1. token.balanceOf(escrow) >= totalLiabilities
 *  2. totalLiabilities == Σ(available + committed + owed) + feesAccrued
 *  3. committed(m) == Σ rewardValue of active enrolments of m
 *  4. owed(m) == Σ remaining of active rewards of m
 */
describe('LoyaltyEscrow: invariants under random operations', () => {
  it('holds for 250 random steps', async function () {
    this.timeout(300_000);
    const ctx = await deploy(250);
    const { escrow, token } = ctx;
    let seed = 20261126;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };

    const merchants: Hex[] = [ctx.merchant, id('m2')];
    await escrow.write.registerMerchant([merchants[1]]);
    const offers: { id: Hex; m: Hex; value: bigint }[] = [];
    for (let i = 0; i < 4; i++) {
      const m = merchants[i % 2];
      const value = BigInt(5_000 + rnd(40_000));
      const percent = i % 2 === 0;
      const o = id('o');
      await escrow.write.createOffer([o, m, offerParams({
        kind: percent ? Kind.Percent : Kind.Credit, percentBps: percent ? 500 + rnd(3000) : 0, rewardValue: value,
        minPurchases: 1 + rnd(3), minTotalSpend: BigInt(rnd(30_000)), minPurchaseAmount: BigInt(rnd(2_000)),
        windowSecs: Number(DAY * BigInt(1 + rnd(5))), perCustomerLimit: 1 + rnd(2), maxEnrolments: 3 + rnd(5),
      })]);
      offers.push({ id: o, m, value });
    }
    const customers = Array.from({ length: 6 }, () => id('c'));
    const enrolmentIds: { id: Hex; offer: (typeof offers)[number] }[] = [];
    const purchaseIds: Hex[] = [];
    const rewardIds: { id: Hex; m: Hex }[] = [];
    let ok = 0;

    const attempt = async (f: () => Promise<unknown>) => {
      try {
        await f();
        ok++;
      } catch {
        /* reverts are fine; invariants must still hold */
      }
    };

    for (let step = 0; step < 250; step++) {
      const op = rnd(11);
      const at = await now();
      if (op === 0) await ctx.fund(BigInt(1_000 + rnd(80_000)), merchants[rnd(2)]);
      else if (op === 1) await attempt(() => escrow.write.withdraw([merchants[rnd(2)], BigInt(1 + rnd(50_000))]));
      else if (op <= 3) {
        const offer = offers[rnd(offers.length)];
        const e = id('e');
        await attempt(async () => {
          await escrow.write.enrol([e, offer.id, customers[rnd(customers.length)], at]);
          enrolmentIds.push({ id: e, offer });
        });
      } else if (op <= 6 && enrolmentIds.length) {
        const en = enrolmentIds[rnd(enrolmentIds.length)];
        const p = id('p');
        const r = id('r');
        await attempt(async () => {
          await escrow.write.recordPurchase([p, en.id, BigInt(1 + rnd(20_000)), at, r]);
          purchaseIds.push(p);
          const rw = await escrow.read.rewards([r]);
          if (rw[6] !== 0) rewardIds.push({ id: r, m: en.offer.m });
        });
      } else if (op === 7 && purchaseIds.length) {
        await attempt(() => escrow.write.voidPurchase([purchaseIds[rnd(purchaseIds.length)], at]));
      } else if (op === 8 && rewardIds.length) {
        await attempt(() => escrow.write.redeem([id('rd'), rewardIds[rnd(rewardIds.length)].id, BigInt(1 + rnd(60_000)), at]));
      } else if (op === 9 && enrolmentIds.length) {
        await attempt(() => escrow.write.cancelEnrolment([enrolmentIds[rnd(enrolmentIds.length)].id, at]));
      } else {
        await increase(BigInt(rnd(3)) * DAY + BigInt(rnd(3600)));
        for (const en of enrolmentIds) await attempt(() => escrow.write.expireEnrolment([en.id]));
        if (rnd(4) === 0) {
          await increase(61n * DAY);
          for (const r of rewardIds) await attempt(() => escrow.write.expireReward([r.id]));
        }
      }

      // ── check invariants ──
      let sum = 0n;
      for (const m of merchants) {
        const [, , available, committed, owed] = await escrow.read.merchants([m]);
        sum += available + committed + owed;
        let expectCommitted = 0n;
        for (const en of enrolmentIds.filter((x) => x.offer.m === m)) {
          const st = await escrow.read.enrolments([en.id]);
          if (st[4] === 1) expectCommitted += en.offer.value;
        }
        let expectOwed = 0n;
        for (const r of rewardIds.filter((x) => x.m === m)) {
          const rw = await escrow.read.rewards([r.id]);
          if (rw[6] === 1) expectOwed += rw[10];
        }
        assert.equal(committed, expectCommitted, `step ${step}: committed mismatch`);
        assert.equal(owed, expectOwed, `step ${step}: owed mismatch`);
      }
      const fees = await escrow.read.feesAccrued();
      const liabilities = await escrow.read.totalLiabilities();
      assert.equal(liabilities, sum + fees, `step ${step}: liabilities mismatch`);
      assert.ok((await token.read.balanceOf([escrow.address])) >= liabilities, `step ${step}: insolvent`);
    }
    assert.ok(ok > 60, `too few successful ops (${ok})`);
  });
});
