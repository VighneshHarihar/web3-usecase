/**
 * The quiet witness (Invisible Chain step 6). Public, no login, no PII.
 * Anyone can recompute the hash chain and compare against the contract.
 */
import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { enrolments, ledgerEvents, merchants, offers, rewards } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { parse, uuidParam } from '../lib/http.js';
import { getChain, readOnChain, readSolvency } from '../chain/index.js';
import { GENESIS } from '../services/ledger.js';
import { offerView, shopView } from '../services/views.js';

const publicEvent = (e: typeof ledgerEvents.$inferSelect) => ({
  seq: e.seq, type: e.type, payload: e.payload, prevHash: e.prevHash, hash: e.hash, createdAt: e.createdAt,
  chainStatus: e.chainStatus, txHash: e.txHash, blockNumber: e.blockNumber,
});

function chainInfo() {
  const c = getChain();
  return c ? { mode: config.CHAIN_MODE, chainId: c.chainId, name: config.CHAIN_NAME, escrow: c.escrow, token: c.token, explorer: config.EXPLORER_URL || null } : { mode: 'off' as const };
}

export default async function proofRoutes(app: FastifyInstance) {
  app.get('/proof/ledger', async (req) => {
    const q = parse(z.object({ after: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(500).default(100) }), req.query);
    const rows = await db.select().from(ledgerEvents).where(gt(ledgerEvents.seq, q.after)).orderBy(asc(ledgerEvents.seq)).limit(q.limit);
    const [last] = await db.select({ seq: ledgerEvents.seq, hash: ledgerEvents.hash }).from(ledgerEvents).orderBy(desc(ledgerEvents.seq)).limit(1);
    return { genesis: GENESIS, head: last ?? null, events: rows.map(publicEvent), chain: chainInfo(), solvency: await readSolvency() };
  });

  app.get('/proof/:kind/:id', async (req) => {
    const { kind, id: raw } = req.params as { kind: string; id: string };
    const id = uuidParam(raw);
    let summary: Record<string, unknown>;
    let events;
    if (kind === 'offer') {
      const [row] = await db.select({ o: offers, m: merchants }).from(offers).innerJoin(merchants, eq(merchants.id, offers.merchantId)).where(eq(offers.id, id));
      if (!row || row.o.status === 'draft') throw notFound();
      summary = { offer: offerView(row.o, row.m), pool: { available: row.m.available, committed: row.m.committed, owed: row.m.owed } };
      events = await db.select().from(ledgerEvents).where(eq(ledgerEvents.subjectId, id)).orderBy(asc(ledgerEvents.seq));
    } else if (kind === 'enrolment') {
      const [row] = await db.select({ e: enrolments, o: offers, m: merchants }).from(enrolments).innerJoin(offers, eq(offers.id, enrolments.offerId))
        .innerJoin(merchants, eq(merchants.id, enrolments.merchantId)).where(eq(enrolments.id, id));
      if (!row) throw notFound();
      summary = { shop: shopView(row.m), offerTitle: row.o.title, offerId: row.o.id, reserved: row.o.rewardValue, status: row.e.status, purchases: row.e.purchases, spend: row.e.spend, deadline: row.e.deadline, rewardId: row.e.rewardId };
      events = await db.select().from(ledgerEvents).where(eq(ledgerEvents.subjectId, id)).orderBy(asc(ledgerEvents.seq));
    } else if (kind === 'reward') {
      const [row] = await db.select({ r: rewards, m: merchants }).from(rewards).innerJoin(merchants, eq(merchants.id, rewards.merchantId)).where(eq(rewards.id, id));
      if (!row) throw notFound();
      summary = { shop: shopView(row.m), value: row.r.value, remaining: row.r.remaining, status: row.r.status, kind: row.r.kind, percentBps: row.r.percentBps, expiresAt: row.r.expiresAt, enrolmentId: row.r.enrolmentId };
      events = await db.select().from(ledgerEvents).where(eq(ledgerEvents.subjectId, id)).orderBy(asc(ledgerEvents.seq));
    } else if (kind === 'merchant') {
      const [m] = await db.select().from(merchants).where(and(eq(merchants.id, id), eq(merchants.status, 'approved')));
      if (!m) throw notFound();
      summary = { shop: shopView(m), pool: { available: m.available, committed: m.committed, owed: m.owed } };
      events = await db.select().from(ledgerEvents).where(eq(ledgerEvents.merchantId, id)).orderBy(desc(ledgerEvents.seq)).limit(100);
    } else throw notFound();
    return { kind, id, summary, events: events.map(publicEvent), onChain: await readOnChain(kind as never, id), chain: chainInfo() };
  });
}
