import { describe, expect, it } from 'vitest';
import { db } from '../src/db/index.js';
import { ledgerEvents } from '../src/db/schema.js';
import { asc } from 'drizzle-orm';
import { verifyChain } from '../src/services/ledger.js';
import { getApp, login, scanCustomer, setupShop, shopInput, sharmaOffer } from './helpers.js';

describe('auth', () => {
  it('logs in with phone + OTP and rejects wrong codes', async () => {
    const app = await getApp();
    const r = await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '98765 00001' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().phone).toBe('+919876500001');
    const bad = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '9876500001', code: r.json().devCode === '000000' ? '111111' : '000000' } });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '9876500001', code: r.json().devCode } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().isNew).toBe(true);
    const reuse = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '9876500001', code: r.json().devCode } });
    expect(reuse.statusCode).toBe(400);
  });

  it('requires a session and blocks cross-site writes', async () => {
    const app = await getApp();
    expect((await app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
    const x = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin: 'https://evil.example' } });
    expect(x.statusCode).toBe(403);
  });
});

describe('merchant onboarding & offers', () => {
  it('pending shops cannot publish or fund; approval registers on the ledger', async () => {
    const owner = await login(undefined, 'Rohan');
    const r = await owner.post('/api/merchants', shopInput({ gstin: 'bad' }));
    expect(r.status).toBe(400);
    const ok = await owner.post('/api/merchants', shopInput());
    const mid = ok.body.merchant.id;
    expect(ok.body.merchant.status).toBe('pending');
    const top = await owner.post(`/api/m/${mid}/pool/topup`, { amount: 100_000 });
    expect(top.status).toBe(403);
    const o = await owner.post(`/api/m/${mid}/offers`, sharmaOffer());
    expect((await owner.post(`/api/m/${mid}/offers/${o.body.offer.id}/publish`)).status).toBe(403);
    const stranger = await login();
    expect((await stranger.get(`/api/m/${mid}`)).status).toBe(403);
  });

  it('rejects expiry-weaponised terms and locks numeric terms after publish (R4)', async () => {
    const { owner, mid, oid } = await setupShop({ fund: 500_000 });
    const bad = await owner.post(`/api/m/${mid}/offers`, sharmaOffer({ rewardValidityDays: 7 }));
    expect(bad.status).toBe(400);
    const edit = await owner.patch(`/api/m/${mid}/offers/${oid}`, { rewardValue: 10_000 });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('TERMS_LOCKED');
    const title = await owner.patch(`/api/m/${mid}/offers/${oid}`, { title: 'Loyal customer offer' });
    expect(title.status).toBe(200);
  });

  it('Free plan: one live offer, ₹10,000 pool cap; Pro lifts both', async () => {
    const { owner, mid } = await setupShop({ fund: 900_000 });
    const o2 = await owner.post(`/api/m/${mid}/offers`, sharmaOffer({ title: 'Second offer' }));
    const pub = await owner.post(`/api/m/${mid}/offers/${o2.body.offer.id}/publish`);
    expect(pub.body.error.code).toBe('PLAN_LIMIT');
    const big = await owner.post(`/api/m/${mid}/pool/topup`, { amount: 200_000 });
    expect(big.body.error.code).toBe('PLAN_LIMIT');
    const up = await owner.post(`/api/m/${mid}/plan/upgrade`);
    expect(up.body.payment.amount).toBe(99_900);
    await owner.post(`/api/payments/${up.body.payment.id}/confirm`, { simulate: 'success' });
    expect((await owner.get(`/api/m/${mid}`)).body.merchant.plan).toBe('pro');
    expect((await owner.post(`/api/m/${mid}/offers/${o2.body.offer.id}/publish`)).status).toBe(200);
    expect((await owner.post(`/api/m/${mid}/pool/topup`, { amount: 200_000 })).status).toBe(200);
  });
});

describe('the whole story (docs/02 worked example)', () => {
  it('join → 3 counter scans → reward → redeem 20% of ₹1,200; balances, ledger and invariants agree', async () => {
    const { owner, admin, mid, oid } = await setupShop({ fund: 1_000_000 });
    const asha = await login(undefined, 'Asha Sharma');

    // discovery
    const list = await asha.get('/api/offers?lat=18.52&lng=73.85');
    const card = list.body.offers.find((o: any) => o.id === oid);
    expect(card.secured).toBe(true);
    expect(card.text.en.condition).toContain('Make 3 purchases totalling ₹1,500');

    // join (R1)
    const j = await asha.post(`/api/c/offers/${oid}/join`);
    expect(j.status).toBe(200);
    expect((await asha.post(`/api/c/offers/${oid}/join`)).body.error.code).toBe('ALREADY_JOINED');
    let pool = (await owner.get(`/api/m/${mid}/pool`)).body.balances;
    expect(pool).toEqual({ available: 970_000, committed: 30_000, owed: 0 });

    // R2: can't withdraw committed money
    const w = await owner.post(`/api/m/${mid}/pool/withdraw`, { amount: 980_000 });
    expect(w.body.error.code).toBe('INSUFFICIENT_AVAILABLE');

    // counter: below minimum doesn't count
    let s = await scanCustomer(owner, mid, asha);
    expect(s.enrolments).toHaveLength(1);
    let p = await owner.post(`/api/m/${mid}/counter/purchase`, { sessionId: s.sessionId, amount: 15_000 });
    expect(p.body.outcomes[0].counted).toBe(false);
    expect(p.body.outcomes[0].reason).toBe('below_minimum');

    for (const amount of [60_000, 45_000]) {
      s = await scanCustomer(owner, mid, asha);
      p = await owner.post(`/api/m/${mid}/counter/purchase`, { sessionId: s.sessionId, amount });
      expect(p.body.outcomes[0].counted).toBe(true);
    }
    s = await scanCustomer(owner, mid, asha);
    p = await owner.post(`/api/m/${mid}/counter/purchase`, { sessionId: s.sessionId, amount: 52_000 });
    expect(p.body.outcomes[0].completed).toBe(true);
    const rewardId = p.body.outcomes[0].rewardId;
    expect(p.body.rewards).toHaveLength(1);

    pool = (await owner.get(`/api/m/${mid}/pool`)).body.balances;
    expect(pool).toEqual({ available: 970_000, committed: 0, owed: 30_000 });

    const home = await asha.get('/api/c/home');
    expect(home.body.rewards[0].id).toBe(rewardId);
    const notes = await asha.get('/api/c/notifications');
    expect(notes.body.items.some((n: any) => n.kind === 'reward')).toBe(true);
    expect(notes.body.items.some((n: any) => n.kind === 'progress')).toBe(true);

    // redeem: two parallel attempts, exactly one wins (PRD edge #14)
    s = await scanCustomer(owner, mid, asha);
    const [a, b] = await Promise.all([
      owner.post(`/api/m/${mid}/counter/redeem`, { sessionId: s.sessionId, rewardId, billAmount: 120_000 }),
      owner.post(`/api/m/${mid}/counter/redeem`, { sessionId: s.sessionId, rewardId, billAmount: 120_000 }),
    ]);
    const wins = [a, b].filter((r) => r.status === 200);
    expect(wins).toHaveLength(1);
    expect(wins[0].body).toMatchObject({ discount: 24_000, payable: 96_000, fee: 480, reimbursed: 23_520, returned: 6_000 });

    pool = (await owner.get(`/api/m/${mid}/pool`)).body.balances;
    expect(pool).toEqual({ available: 970_000 + 23_520 + 6_000, committed: 0, owed: 0 });

    // can join again? perCustomerLimit = 1
    expect((await asha.post(`/api/c/offers/${oid}/join`)).body.error.code).toBe('CUSTOMER_LIMIT');

    // witness: proof pages and a valid hash chain
    const proof = await asha.get(`/api/proof/reward/${rewardId}`);
    expect(proof.body.events.map((e: any) => e.type)).toEqual(['reward.issued', 'reward.redeemed']);
    expect(JSON.stringify(proof.body)).not.toContain('+91');
    const events = await db.select().from(ledgerEvents).orderBy(asc(ledgerEvents.seq));
    expect(verifyChain(events)).toBeNull();

    // admin: mirror invariant holds
    const ov = await admin.get('/api/admin/overview');
    expect(ov.body.invariantMismatches).toEqual([]);

    // customer data export / activity
    const act = await asha.get('/api/c/activity');
    expect(act.body.items.find((i: any) => i.kind === 'redeemed').amount).toBe(24_000);
  });

  it('pool full → waitlist → capacity returns → notified (PRD edge #1)', async () => {
    const { owner, mid, oid } = await setupShop({ fund: 30_000 });
    const c1 = await login();
    const c2 = await login();
    expect((await c1.post(`/api/c/offers/${oid}/join`)).status).toBe(200);
    const full = await c2.post(`/api/c/offers/${oid}/join`);
    expect(full.body.error.code).toBe('POOL_FULL');
    expect((await c2.get(`/api/offers/${oid}`)).body.offer.spotsLeft).toBe(0);
    await c2.post(`/api/c/offers/${oid}/waitlist`);
    const top = await owner.post(`/api/m/${mid}/pool/topup`, { amount: 30_000 });
    await owner.post(`/api/payments/${top.body.payment.id}/confirm`, { simulate: 'success' });
    const n = await c2.get('/api/c/notifications');
    expect(n.body.items[0].kind).toBe('waitlist');
    expect((await c2.post(`/api/c/offers/${oid}/join`)).status).toBe(200);
  });

  it('void within 24 h revokes an unused reward and restores progress (PRD edge #7)', async () => {
    const { owner, mid, oid } = await setupShop({ fund: 100_000, offer: { minPurchases: 1, minTotalSpend: 0, minPurchaseAmount: 0, rewardKind: 'credit', percentBps: 0, rewardValue: 20_000 } });
    const c = await login();
    const j = await c.post(`/api/c/offers/${oid}/join`);
    let s = await scanCustomer(owner, mid, c);
    const p = await owner.post(`/api/m/${mid}/counter/purchase`, { sessionId: s.sessionId, amount: 50_000 });
    expect(p.body.outcomes[0].completed).toBe(true);
    const v = await owner.post(`/api/m/${mid}/counter/visits/${p.body.visitId}/void`);
    expect(v.status).toBe(200);
    const e = await c.get(`/api/c/enrolments/${j.body.enrolment.id}`);
    expect(e.body.enrolment.status).toBe('active');
    expect(e.body.enrolment.purchases).toBe(0);
    let pool = (await owner.get(`/api/m/${mid}/pool`)).body.balances;
    expect(pool).toEqual({ available: 80_000, committed: 20_000, owed: 0 });

    // complete again, use some of it → void refused (R3)
    s = await scanCustomer(owner, mid, c);
    const p2 = await owner.post(`/api/m/${mid}/counter/purchase`, { sessionId: s.sessionId, amount: 10_000 });
    const rid = p2.body.outcomes[0].rewardId;
    s = await scanCustomer(owner, mid, c);
    const red = await owner.post(`/api/m/${mid}/counter/redeem`, { sessionId: s.sessionId, rewardId: rid, billAmount: 5_000 });
    expect(red.body.remaining).toBe(15_000);
    const v2 = await owner.post(`/api/m/${mid}/counter/visits/${p2.body.visitId}/void`);
    expect(v2.body.error.code).toBe('REWARD_USED');
    pool = (await owner.get(`/api/m/${mid}/pool`)).body.balances;
    expect(pool.owed).toBe(15_000);
  });

  it('counter needs a live presence code; staff see only masked phone', async () => {
    const { owner, mid, oid } = await setupShop({ fund: 100_000 });
    const c = await login(undefined, 'Meena Kulkarni');
    await c.post(`/api/c/offers/${oid}/join`);
    expect((await owner.post(`/api/m/${mid}/counter/lookup`, { code: '000000' })).status).toBe(400);
    expect((await owner.post(`/api/m/${mid}/counter/lookup`, { code: 'LL1.123456.0000000000000000' })).status).toBe(400);
    const s = await scanCustomer(owner, mid, c);
    expect((s as any).customer.name).toBe('Meena');
    expect((s as any).customer.phone).toMatch(/^••••\d{4}$/);
    const other = await login();
    expect((await other.post(`/api/m/${mid}/counter/purchase`, { sessionId: s.sessionId, amount: 100 })).status).toBe(403);
  });

  it('cancel returns the reservation; account deletion scrubs PII', async () => {
    const { owner, mid, oid } = await setupShop({ fund: 100_000 });
    const c = await login(undefined, 'Temp User');
    const j = await c.post(`/api/c/offers/${oid}/join`);
    expect((await c.post(`/api/c/enrolments/${j.body.enrolment.id}/cancel`)).status).toBe(200);
    expect((await owner.get(`/api/m/${mid}/pool`)).body.balances.committed).toBe(0);
    await c.post(`/api/c/offers/${oid}/join`);
    const exp = await c.get('/api/me/export');
    expect(exp.body.enrolments).toHaveLength(2);
    expect((await c.del('/api/me')).status).toBe(200);
    expect((await c.get('/api/me')).status).toBe(401);
    expect((await owner.get(`/api/m/${mid}/pool`)).body.balances.committed).toBe(0);
  });
});
