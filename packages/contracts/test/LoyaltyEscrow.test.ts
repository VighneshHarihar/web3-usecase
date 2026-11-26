import assert from 'node:assert/strict';
import { DAY, deploy, expectRevert, id, increase, Kind, now, offerParams } from './helpers';

describe('LoyaltyEscrow: lifecycle (docs/02 worked example)', () => {
  it('join → 3 purchases → reward → redeem 20% of ₹1,200', async () => {
    const { escrow, merchant, fund, merchantState, token } = await deploy();
    await fund(1_000_000n); // ₹10,000
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams()]);

    const cust = id('c');
    const e = id('e');
    await escrow.write.enrol([e, offer, cust, await now()]);
    let m = await merchantState();
    assert.equal(m.available, 970_000n);
    assert.equal(m.committed, 30_000n);

    // R2: can't withdraw committed money
    await expectRevert(escrow.write.withdraw([merchant, 970_001n]), 'InsufficientAvailable');

    await escrow.write.recordPurchase([id('p'), e, 60_000n, await now(), id('r0')]);
    await escrow.write.recordPurchase([id('p'), e, 45_000n, await now(), id('r0')]);
    const reward = id('r');
    await escrow.write.recordPurchase([id('p'), e, 52_000n, await now(), reward]);

    const r = await escrow.read.rewards([reward]);
    assert.equal(r[6], 1); // RStatus.Active
    assert.equal(r[9], 30_000n);
    m = await merchantState();
    assert.equal(m.committed, 0n);
    assert.equal(m.owed, 30_000n);

    await escrow.write.redeem([id('rd'), reward, 120_000n, await now()]);
    m = await merchantState();
    assert.equal(m.owed, 0n);
    // 970000 + (24000 - 480) + 6000
    assert.equal(m.available, 999_520n);
    assert.equal(await escrow.read.feesAccrued(), 480n);
    assert.equal(await escrow.read.totalLiabilities(), 1_000_000n);
    assert.equal(await escrow.read.solvent(), true);
    assert.equal(await token.read.balanceOf([escrow.address]), 1_000_000n);
    await expectRevert(escrow.write.redeem([id('rd'), reward, 1000n, await now()]), 'NotActive');
  });

  it('expiry returns the reservation (PRD happy #4)', async () => {
    const { escrow, merchant, fund, merchantState } = await deploy();
    await fund(100_000n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams()]);
    const e = id('e');
    await escrow.write.enrol([e, offer, id('c'), await now()]);
    await expectRevert(escrow.write.expireEnrolment([e]), 'TooEarly');
    await increase(30n * DAY + 61n);
    await expectRevert(escrow.write.recordPurchase([id('p'), e, 60_000n, await now(), id('r')]), 'DeadlinePassed');
    await escrow.write.expireEnrolment([e]);
    const m = await merchantState();
    assert.equal(m.available, 100_000n);
    assert.equal(m.committed, 0n);
  });

  it('a last-second purchase within the 60 s grace counts', async () => {
    const { escrow, merchant, fund } = await deploy();
    await fund(100_000n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams({ minPurchases: 1, minTotalSpend: 0n, minPurchaseAmount: 0n })]);
    const e = id('e');
    const start = await now();
    await escrow.write.enrol([e, offer, id('c'), start]);
    await increase(30n * DAY + 30n);
    await escrow.write.recordPurchase([id('p'), e, 100n, await now(), id('r')]);
    const en = await escrow.read.enrolments([e]);
    assert.equal(en[4], 2); // Completed
  });

  it('refuses to join when the pool cannot cover the reward, at the cap, or twice', async () => {
    const { escrow, merchant, fund } = await deploy();
    await fund(29_999n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams({ maxEnrolments: 2 })]);
    await expectRevert(escrow.write.enrol([id('e'), offer, id('c'), await now()]), 'InsufficientAvailable');
    await fund(100_000n);
    const c = id('c');
    await escrow.write.enrol([id('e'), offer, c, await now()]);
    await expectRevert(escrow.write.enrol([id('e'), offer, c, await now()]), 'AlreadyEnrolled');
    await escrow.write.enrol([id('e'), offer, id('c'), await now()]);
    await expectRevert(escrow.write.enrol([id('e'), offer, id('c'), await now()]), 'CapReached');
  });

  it('enforces per-customer limit and cancel frees the slot', async () => {
    const { escrow, merchant, fund, merchantState } = await deploy();
    await fund(100_000n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams({ minPurchases: 1, minTotalSpend: 0n, minPurchaseAmount: 0n })]);
    const c = id('c');
    const e1 = id('e');
    await escrow.write.enrol([e1, offer, c, await now()]);
    await escrow.write.cancelEnrolment([e1, await now()]);
    assert.equal((await merchantState()).committed, 0n);
    const e2 = id('e');
    await escrow.write.enrol([e2, offer, c, await now()]);
    await escrow.write.recordPurchase([id('p'), e2, 500n, await now(), id('r')]);
    await expectRevert(escrow.write.enrol([id('e'), offer, c, await now()]), 'CustomerLimit');
  });

  it('void within 24 h revokes an unused reward; not after use; not after 24 h', async () => {
    const { escrow, merchant, fund, merchantState } = await deploy();
    await fund(200_000n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams({ minPurchases: 1, minTotalSpend: 0n, minPurchaseAmount: 0n, kind: Kind.Credit, percentBps: 0 })]);
    const c = id('c');
    const e = id('e');
    await escrow.write.enrol([e, offer, c, await now()]);
    const p = id('p');
    const r = id('r');
    await escrow.write.recordPurchase([p, e, 500n, await now(), r]);
    assert.equal((await merchantState()).owed, 30_000n);
    await escrow.write.voidPurchase([p, await now()]);
    let m = await merchantState();
    assert.equal(m.owed, 0n);
    assert.equal(m.committed, 30_000n);
    assert.equal((await escrow.read.enrolments([e]))[4], 1); // Active again
    await expectRevert(escrow.write.voidPurchase([p, await now()]), 'AlreadyExists');

    // complete again, use part of it, void is refused
    const p2 = id('p');
    const r2 = id('r');
    await escrow.write.recordPurchase([p2, e, 700n, await now(), r2]);
    await escrow.write.redeem([id('rd'), r2, 1000n, await now()]);
    await expectRevert(escrow.write.voidPurchase([p2, await now()]), 'RewardUsed');

    // a purchase on another enrolment older than 24 h can't be voided
    const e3 = id('e');
    await escrow.write.enrol([e3, offer, id('c'), await now()]);
    const p3 = id('p');
    await escrow.write.recordPurchase([p3, e3, 900n, await now(), id('r')]);
    await increase(DAY + 5n);
    await expectRevert(escrow.write.voidPurchase([p3, await now()]), 'WindowClosed');
    m = await merchantState();
    assert.equal(m.owed, 30_000n - 1000n + 30_000n);
  });

  it('credit rewards can be used in parts; expiry returns the remainder', async () => {
    const { escrow, merchant, fund, merchantState } = await deploy();
    await fund(50_000n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams({ kind: Kind.Credit, percentBps: 0, rewardValue: 45_000n, minPurchases: 1, minTotalSpend: 0n, minPurchaseAmount: 0n })]);
    const e = id('e');
    await escrow.write.enrol([e, offer, id('c'), await now()]);
    const r = id('r');
    await escrow.write.recordPurchase([id('p'), e, 1000n, await now(), r]);
    await escrow.write.redeem([id('rd'), r, 12_000n, await now()]);
    assert.equal((await escrow.read.rewards([r]))[10], 33_000n);
    await expectRevert(escrow.write.expireReward([r]), 'TooEarly');
    await increase(60n * DAY + 1n);
    await expectRevert(escrow.write.redeem([id('rd'), r, 100n, await now()]), 'WindowClosed');
    await escrow.write.expireReward([r]);
    const m = await merchantState();
    assert.equal(m.owed, 0n);
    assert.equal(m.available, 5_000n + 11_760n + 33_000n);
  });

  it('validates purchases and timestamps', async () => {
    const { escrow, merchant, fund } = await deploy();
    await fund(100_000n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams()]);
    const e = id('e');
    await escrow.write.enrol([e, offer, id('c'), await now()]);
    await expectRevert(escrow.write.recordPurchase([id('p'), e, 19_999n, await now(), id('r')]), 'BelowMinimum');
    await expectRevert(escrow.write.recordPurchase([id('p'), e, 20_000n, (await now()) + 1000n, id('r')]), 'BadTimestamp');
    await expectRevert(escrow.write.recordPurchase([id('p'), e, 20_000n, (await now()) - 73n * 3600n, id('r')]), 'BadTimestamp');
    const p = id('p');
    await escrow.write.recordPurchase([p, e, 20_000n, await now(), id('r')]);
    await expectRevert(escrow.write.recordPurchase([p, e, 20_000n, await now(), id('r')]), 'AlreadyExists');
  });

  it('rejects invalid offers: short validity (expiry weaponisation), bad percent', async () => {
    const { escrow, merchant } = await deploy();
    await expectRevert(escrow.write.createOffer([id('o'), merchant, offerParams({ validitySecs: Number(7n * DAY) })]), 'InvalidParams');
    await expectRevert(escrow.write.createOffer([id('o'), merchant, offerParams({ percentBps: 0 })]), 'InvalidParams');
    await expectRevert(escrow.write.createOffer([id('o'), merchant, offerParams({ kind: Kind.Credit })]), 'InvalidParams');
  });
});

describe('LoyaltyEscrow: roles, pause, freeze, fees', () => {
  it('only the operator acts; only the guardian pauses; pause blocks new joins but not redemption', async () => {
    const { escrow, merchant, fund, guardian, other } = await deploy();
    await fund(100_000n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams({ minPurchases: 1, minTotalSpend: 0n, minPurchaseAmount: 0n })]);
    await expectRevert(escrow.write.enrol([id('e'), offer, id('c'), await now()], { account: other.account }), 'AccessControlUnauthorizedAccount');
    await expectRevert(escrow.write.pause({ account: other.account }), 'AccessControlUnauthorizedAccount');
    const e = id('e');
    await escrow.write.enrol([e, offer, id('c'), await now()]);
    const r = id('r');
    await escrow.write.recordPurchase([id('p'), e, 500n, await now(), r]);

    await escrow.write.pause({ account: guardian.account });
    await expectRevert(escrow.write.enrol([id('e'), offer, id('c'), await now()]), 'EnforcedPause');
    await escrow.write.redeem([id('rd'), r, 1000n, await now()]); // customers' rights continue
    await escrow.write.withdraw([merchant, 1000n]); // merchant's available money stays theirs
    await escrow.write.unpause({ account: guardian.account });
  });

  it('frozen merchant: no withdrawal or joins, but customers can still redeem', async () => {
    const { escrow, merchant, fund, guardian } = await deploy();
    await fund(100_000n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams({ minPurchases: 1, minTotalSpend: 0n, minPurchaseAmount: 0n })]);
    const e = id('e');
    await escrow.write.enrol([e, offer, id('c'), await now()]);
    const r = id('r');
    await escrow.write.recordPurchase([id('p'), e, 500n, await now(), r]);
    await escrow.write.setMerchantFrozen([merchant, true], { account: guardian.account });
    await expectRevert(escrow.write.withdraw([merchant, 100n]), 'Frozen');
    await expectRevert(escrow.write.enrol([id('e'), offer, id('c'), await now()]), 'Frozen');
    await escrow.write.redeem([id('rd'), r, 1000n, await now()]);
  });

  it('fee is capped at 3% and snapshotted per offer (R5)', async () => {
    const { escrow, merchant, fund, admin } = await deploy(200);
    await expectRevert(escrow.write.setFeeBps([301]), 'InvalidParams');
    await fund(100_000n);
    const offer = id('o');
    await escrow.write.createOffer([offer, merchant, offerParams({ minPurchases: 1, minTotalSpend: 0n, minPurchaseAmount: 0n, kind: Kind.Credit, percentBps: 0, rewardValue: 10_000n })]);
    await escrow.write.setFeeBps([300]);
    const e = id('e');
    await escrow.write.enrol([e, offer, id('c'), await now()]);
    const r = id('r');
    await escrow.write.recordPurchase([id('p'), e, 500n, await now(), r]);
    await escrow.write.redeem([id('rd'), r, 10_000n, await now()]);
    assert.equal(await escrow.read.feesAccrued(), 200n); // 2% snapshot, not 3%
    await escrow.write.withdrawFees([admin.account.address]);
    assert.equal(await escrow.read.feesAccrued(), 0n);
    assert.equal(await escrow.read.solvent(), true);
  });
});
