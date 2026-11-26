/**
 * The quiet witness (Invisible Chain step 6). The ONLY part of the UI where technical words
 * appear. Anyone, logged in or not, can check the records and recompute the hash chain.
 */
import { useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { canonicalJSON } from '@loyallink/shared/core';
import { api } from '../lib/api';
import { fmtDate, formatINR } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, Card, ErrorBox, Loading, PageTitle, Pill } from '../components/ui';

type Ev = { seq: number; type: string; payload: Record<string, unknown>; prevHash: string; hash: string; createdAt: string; chainStatus: string; txHash: string | null; blockNumber: number | null };
type ChainInfo = { mode: string; chainId?: number; name?: string; escrow?: string; token?: string; explorer?: string | null };

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Same formula as apps/api/src/services/ledger.ts computeHash. */
export async function verifyEvents(events: Ev[], startPrev: string) {
  let prev = startPrev;
  for (const e of events) {
    const h = '0x' + (await sha256Hex(`${prev}|${e.seq}|${e.type}|${canonicalJSON(e.payload)}|${new Date(e.createdAt).toISOString()}`));
    if (e.prevHash !== prev || h !== e.hash) return { ok: false, brokenAt: e.seq };
    prev = e.hash;
  }
  return { ok: true, brokenAt: null };
}

const short = (h?: string | null) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : '—');

function ChainBox({ chain }: { chain: ChainInfo }) {
  const { t } = useTranslation();
  if (chain.mode === 'off') return <Card tone="alt" className="p-4 text-sm text-ink2">{t('proofp.chainOff')}</Card>;
  return (
    <Card tone="alt" className="p-4 text-sm space-y-1 break-all">
      <div><b>{t('proofp.network')}:</b> {chain.name} (chain id {chain.chainId})</div>
      <div><b>LoyaltyEscrow:</b> <code>{chain.escrow}</code></div>
      <div><b>{t('proofp.token')}:</b> <code>{chain.token}</code></div>
      {chain.explorer && <a className="underline inline-flex items-center gap-1" href={`${chain.explorer}/address/${chain.escrow}`} target="_blank" rel="noreferrer">{t('proofp.explorer')}<Icon name="external" size={14} /></a>}
    </Card>
  );
}

function EventList({ events, chain }: { events: Ev[]; chain: ChainInfo }) {
  const { t } = useTranslation();
  return (
    <Card className="divide-y divide-line">
      {events.map((e) => (
        <details key={e.seq} className="p-4 group">
          <summary className="flex flex-wrap items-center gap-2 cursor-pointer list-none">
            <span className="text-ink2 tabular-nums w-12">#{e.seq}</span>
            <span className="font-semibold flex-1">{t(`proofp.ev.${e.type}`, { defaultValue: e.type })}</span>
            <Pill tone={e.chainStatus === 'confirmed' ? 'ok' : e.chainStatus === 'failed' ? 'danger' : e.chainStatus === 'pending' ? 'warn' : 'neutral'}>{t(`proofp.st.${e.chainStatus}`)}</Pill>
            <span className="text-xs text-ink2">{fmtDate(e.createdAt, true)}</span>
          </summary>
          <div className="mt-3 text-xs space-y-1 break-all">
            <div><b>hash</b> <code>{e.hash}</code></div>
            <div><b>prev</b> <code>{e.prevHash}</code></div>
            {e.txHash && <div><b>tx</b> {chain.explorer ? <a className="underline" href={`${chain.explorer}/tx/${e.txHash}`} target="_blank" rel="noreferrer">{e.txHash}</a> : <code>{e.txHash}</code>} {e.blockNumber && `(block ${e.blockNumber})`}</div>}
            <pre className="mt-2 p-3 rounded-xl bg-alt whitespace-pre-wrap">{JSON.stringify(e.payload, null, 2)}</pre>
          </div>
        </details>
      ))}
      {events.length === 0 && <div className="p-4 text-ink2 text-sm">{t('proofp.noEvents')}</div>}
    </Card>
  );
}

function LedgerPage() {
  const { t } = useTranslation();
  const [verify, setVerify] = useState<{ ok: boolean; brokenAt: number | null; count: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery<{ genesis: string; head: { seq: number; hash: string } | null; events: Ev[]; chain: ChainInfo; solvency: any }>({ queryKey: ['ledger'], queryFn: () => api.get('/proof/ledger?limit=200') });

  async function runVerify() {
    setBusy(true);
    let after = 0;
    let prev = q.data!.genesis;
    let count = 0;
    for (;;) {
      const page = await api.get<{ events: Ev[] }>(`/proof/ledger?after=${after}&limit=500`);
      if (!page.events.length) break;
      const r = await verifyEvents(page.events, prev);
      count += page.events.length;
      if (!r.ok) { setVerify({ ...r, count }); setBusy(false); return; }
      prev = page.events[page.events.length - 1].hash;
      after = page.events[page.events.length - 1].seq;
    }
    setVerify({ ok: true, brokenAt: null, count });
    setBusy(false);
  }

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data!;
  return (
    <div className="space-y-4">
      <p className="text-ink2 leading-relaxed">{t('proofp.ledgerIntro')}</p>
      <Card className="p-5 space-y-3">
        <div className="text-sm"><b>{t('proofp.head')}:</b> #{d.head?.seq ?? 0} <code className="break-all">{short(d.head?.hash)}</code></div>
        {d.solvency && !d.solvency.error && <Pill tone={d.solvency.solvent ? 'ok' : 'danger'} icon="shield">{d.solvency.solvent ? t('proofp.solvent', { amount: formatINR(d.solvency.balance) }) : t('proofp.insolvent')}</Pill>}
        <Button onClick={runVerify} loading={busy} icon="shield">{t('proofp.verify')}</Button>
        {verify && (verify.ok ? <div className="text-ok font-semibold">{t('proofp.verified', { count: verify.count })}</div> : <div className="text-danger font-semibold">{t('proofp.broken', { seq: verify.brokenAt })}</div>)}
      </Card>
      <ChainBox chain={d.chain} />
      <EventList events={[...d.events].reverse()} chain={d.chain} />
    </div>
  );
}

function ItemPage() {
  const { kind, id } = useParams();
  const { t } = useTranslation();
  const q = useQuery<{ summary: any; events: Ev[]; onChain: any; chain: ChainInfo }>({ queryKey: ['proof', kind, id], queryFn: () => api.get(`/proof/${kind}/${id}`) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { summary: s, events, onChain, chain } = q.data!;
  const amount = s.offer?.terms.rewardValue ?? s.reserved ?? s.value;
  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-2">
        <div className="text-xs uppercase tracking-wide text-ink2 font-semibold">{t(`proofp.kind.${kind}`)}</div>
        <div className="text-xl font-bold">{s.offer?.title ?? s.offerTitle ?? s.shop?.name}</div>
        <div className="text-sm text-ink2">{s.shop?.name ?? s.offer?.shop.name}</div>
        {amount !== undefined && <div className="text-sm">{t('proofp.amount')}: <b>{formatINR(amount)}</b></div>}
        {s.status && <div className="text-sm">{t('proofp.status')}: <b>{s.status}</b></div>}
        {s.pool && <div className="text-sm">{t('proofp.pool', { available: formatINR(s.pool.available), committed: formatINR(s.pool.committed), owed: formatINR(s.pool.owed) })}</div>}
        {s.deadline && <div className="text-sm">{t('proofp.deadline')}: {fmtDate(s.deadline, true)}</div>}
        {s.offer?.termsHash && <div className="text-xs break-all"><b>termsHash</b> <code>{s.offer.termsHash}</code></div>}
      </Card>
      <Card className="p-5 text-sm">
        <div className="font-bold mb-2">{t('proofp.onChain')}</div>
        {onChain ? <pre className="p-3 rounded-xl bg-alt whitespace-pre-wrap break-all text-xs">{JSON.stringify(onChain, null, 2)}</pre> : <div className="text-ink2">{t('proofp.chainOff')}</div>}
      </Card>
      <ChainBox chain={chain} />
      <EventList events={events} chain={chain} />
      <Link to="/proof" className="underline text-sm">{t('proofp.fullLedger')}</Link>
    </div>
  );
}

export default function ProofApp() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl pb-16">
      <PageTitle title={t('proofp.title')} sub={t('proofp.sub')} back="/" />
      <div className="px-5">
        <Routes>
          <Route index element={<LedgerPage />} />
          <Route path=":kind/:id" element={<ItemPage />} />
        </Routes>
      </div>
    </div>
  );
}
