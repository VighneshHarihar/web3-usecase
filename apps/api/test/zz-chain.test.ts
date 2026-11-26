/**
 * Mirrors the whole ledger (including every event created by the other test files) onto a real
 * local EVM and checks the DB and the contract agree. This is the divergence test for ADR-07.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const PORT = 8546;
let node: ChildProcess;

async function waitForRpc(url: string) {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) });
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('hardhat node did not start');
}

beforeAll(async () => {
  const cwd = path.resolve(__dirname, '../../../packages/contracts');
  node = spawn('npx', ['hardhat', 'node', '--port', String(PORT)], { cwd, stdio: 'ignore', detached: true });
  await waitForRpc(`http://127.0.0.1:${PORT}`);
  // The sweeper test simulated "31 days later"; move chain time past that so those expiries are valid.
  await fetch(`http://127.0.0.1:${PORT}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'evm_increaseTime', params: [62 * 86400] }) });
  process.env.CHAIN_MODE = 'local';
  process.env.RPC_URL = `http://127.0.0.1:${PORT}`;
  fs.rmSync(path.resolve(process.cwd(), '.deployments', 'chain-31337.json'), { force: true });
});

afterAll(() => {
  if (node?.pid) {
    try {
      process.kill(-node.pid, 'SIGTERM'); // the whole process group (npx → hardhat)
    } catch {
      /* already gone */
    }
  }
});

describe('chain relayer', () => {
  it('replays every ledger event onto LoyaltyEscrow; balances and solvency match', async () => {
    const { initChain, readOnChain, readSolvency } = await import('../src/chain/index.js');
    const { relayAll } = await import('../src/chain/relayer.js');
    const { db } = await import('../src/db/index.js');
    const { ledgerEvents, merchants } = await import('../src/db/schema.js');
    const { getApp, login, scanCustomer, setupShop } = await import('./helpers.js');
    await getApp();
    const { eq } = await import('drizzle-orm');

    const c = await initChain();
    expect(c).toBeTruthy();

    // A fresh story while the chain is on
    const { owner, mid, oid } = await setupShop({ fund: 200_000, offer: { minPurchases: 2, minTotalSpend: 0, minPurchaseAmount: 0 } });
    const cust = await login();
    await cust.post(`/api/c/offers/${oid}/join`);
    for (let i = 0; i < 2; i++) {
      const s = await scanCustomer(owner, mid, cust);
      await owner.post(`/api/m/${mid}/counter/purchase`, { sessionId: s.sessionId, amount: 80_000 });
    }
    const home = await cust.get('/api/c/home');
    const s = await scanCustomer(owner, mid, cust);
    await owner.post(`/api/m/${mid}/counter/redeem`, { sessionId: s.sessionId, rewardId: home.body.rewards[0].id, billAmount: 100_000 });
    await owner.post(`/api/m/${mid}/pool/withdraw`, { amount: 10_000 });

    await relayAll(200);

    const all = await db.select().from(ledgerEvents);
    const failed = all.filter((e) => e.chainStatus === 'failed');
    expect(failed.map((f) => `${f.seq} ${f.type} ${f.error}`)).toEqual([]);
    expect(all.filter((e) => e.chainStatus === 'pending')).toEqual([]);
    expect(all.some((e) => e.chainStatus === 'confirmed' && e.txHash)).toBe(true);

    // every approved merchant's on-chain balances equal the DB mirror
    const ms = await db.select().from(merchants).where(eq(merchants.status, 'approved'));
    for (const m of ms) {
      const on = (await readOnChain('merchant', m.id)) as any;
      expect({ a: on.available, c: on.committed, o: on.owed }).toEqual({ a: m.available, c: m.committed, o: m.owed });
    }
    const sol = (await readSolvency()) as any;
    expect(sol.solvent).toBe(true);

    const proof = await cust.get(`/api/proof/reward/${home.body.rewards[0].id}`);
    expect(proof.body.onChain.status).toBe('used');
    expect(proof.body.events.every((e: any) => e.chainStatus !== 'failed')).toBe(true);
  }, 300_000);
});
