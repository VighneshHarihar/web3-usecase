import { describe, expect, it } from 'vitest';
import { sweepOnce } from '../src/workers/index.js';
import { login, scanCustomer, setupShop } from './helpers.js';

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

describe('sweeper', () => {
  it('expires enrolments after the window and returns the reservation (PRD happy #4)', async () => {
    const { owner, mid, oid } = await setupShop({ fund: 100_000 });
    const c = await login();
    const j = await c.post(`/api/c/offers/${oid}/join`);
    await sweepOnce(days(29.5)); // reminder only
    let n = await c.get('/api/c/notifications');
    expect(n.body.items.some((i: any) => i.kind === 'ending')).toBe(true);
    await sweepOnce(days(31));
    const e = await c.get(`/api/c/enrolments/${j.body.enrolment.id}`);
    expect(e.body.enrolment.status).toBe('expired');
    expect((await owner.get(`/api/m/${mid}/pool`)).body.balances).toEqual({ available: 100_000, committed: 0, owed: 0 });
    n = await c.get('/api/c/notifications');
    expect(n.body.items.some((i: any) => i.kind === 'expired')).toBe(true);
  });

  it('reminds before reward expiry, then returns unused value to the merchant', async () => {
    const { owner, mid, oid } = await setupShop({ fund: 100_000, offer: { minPurchases: 1, minTotalSpend: 0, minPurchaseAmount: 0, rewardKind: 'credit', percentBps: 0, rewardValue: 25_000, rewardValidityDays: 30 } });
    const c = await login();
    await c.post(`/api/c/offers/${oid}/join`);
    const s = await scanCustomer(owner, mid, c);
    await owner.post(`/api/m/${mid}/counter/purchase`, { sessionId: s.sessionId, amount: 1_000 });
    await sweepOnce(days(24));
    const n = await c.get('/api/c/notifications');
    expect(n.body.items.some((i: any) => i.kind === 'reward_expiring')).toBe(true);
    await sweepOnce(days(31));
    expect((await owner.get(`/api/m/${mid}/pool`)).body.balances).toEqual({ available: 100_000, committed: 0, owed: 0 });
    const r = await c.get('/api/c/rewards');
    expect(r.body.rewards[0].status).toBe('expired');
  });
});
