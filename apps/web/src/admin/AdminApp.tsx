import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errMsg } from '../lib/api';
import { useMe } from '../lib/session';
import { fmtDate, formatINR } from '../lib/format';
import { Button, Card, Empty, ErrorBox, Input, Loading, PageTitle, Pill, Segmented, Stat, useToast } from '../components/ui';

/** Platform ops console (Persona 5: Priya). English-only by design: internal tool. */
export default function AdminApp() {
  const me = useMe();
  const [tab, setTab] = useState<'overview' | 'shops' | 'payouts' | 'ledger' | 'flags'>('overview');
  if (!me.data?.user.isAdmin) return <ErrorBox error={new Error('Admins only')} />;
  return (
    <div className="max-w-5xl mx-auto pb-16">
      <PageTitle title="LoyalLink ops" sub="KYC, escrow health, payouts and the ledger" back="/profile" />
      <div className="px-5 overflow-x-auto no-scrollbar">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'overview', label: 'Overview' }, { value: 'shops', label: 'Shops' }, { value: 'payouts', label: 'Payouts' }, { value: 'ledger', label: 'Ledger' }, { value: 'flags', label: 'Flags' },
        ]} />
      </div>
      <div className="px-5 mt-5">
        {tab === 'overview' && <Overview />}
        {tab === 'shops' && <Shops />}
        {tab === 'payouts' && <Payouts />}
        {tab === 'ledger' && <Ledger />}
        {tab === 'flags' && <Flags />}
      </div>
    </div>
  );
}

function Overview() {
  const q = useQuery<any>({ queryKey: ['admin-ov'], queryFn: () => api.get('/admin/overview'), refetchInterval: 15_000 });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  const sol = d.chain.solvency;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Users" value={d.users} />
        <Stat label="Shops pending" value={d.merchants.pending ?? 0} tone={d.merchants.pending ? 'accent' : undefined} sub={`${d.merchants.approved ?? 0} approved`} />
        <Stat label="Redeemed (north star)" value={formatINR(d.redemptions.value)} tone="ok" sub={`${d.redemptions.count} redemptions`} />
        <Stat label="Fees earned" value={formatINR(d.redemptions.fees)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-5 space-y-2 text-sm">
          <div className="font-bold text-base">Escrow (DB mirror)</div>
          <div className="flex justify-between"><span>Available</span><b>{formatINR(d.pool.available)}</b></div>
          <div className="flex justify-between"><span>Committed to customers in progress</span><b>{formatINR(d.pool.committed)}</b></div>
          <div className="flex justify-between"><span>Owed (earned, unredeemed)</span><b>{formatINR(d.pool.owed)}</b></div>
          <div className="pt-2">{d.invariantMismatches.length === 0 ? <Pill tone="ok" icon="check">Balance invariant holds</Pill> : <Pill tone="danger" icon="alert">{d.invariantMismatches.length} invariant mismatches</Pill>}</div>
        </Card>
        <Card className="p-5 space-y-2 text-sm">
          <div className="font-bold text-base">Chain relayer</div>
          <div className="flex justify-between"><span>Mode</span><b>{d.chain.enabled ? (d.chain.ready ? 'on' : 'starting') : 'off (ledger only)'}</b></div>
          {['pending', 'confirmed', 'failed', 'skipped'].map((k) => <div key={k} className="flex justify-between"><span className="capitalize">{k}</span><b className={k === 'failed' && d.ledger[k] ? 'text-danger' : ''}>{d.ledger[k] ?? 0}</b></div>)}
          {d.ledger.oldestPending && <div className="text-warn">Oldest pending: {fmtDate(d.ledger.oldestPending, true)}</div>}
          {d.chain.lastError && <div className="text-danger break-all">Last error: {d.chain.lastError}</div>}
          {sol && !sol.error && <div className="pt-2">{sol.solvent ? <Pill tone="ok" icon="shield">Contract solvent · liabilities {formatINR(sol.liabilities)}</Pill> : <Pill tone="danger">INSOLVENT</Pill>}</div>}
        </Card>
      </div>
      {d.invariantMismatches.length > 0 && (
        <Card className="p-5 text-sm"><pre className="whitespace-pre-wrap">{JSON.stringify(d.invariantMismatches, null, 2)}</pre></Card>
      )}
    </div>
  );
}

function Shops() {
  const qc = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const q = useQuery<{ merchants: any[] }>({ queryKey: ['admin-shops', status], queryFn: () => api.get(`/admin/merchants?status=${status}`) });
  const act = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason?: string }) => api.post(`/admin/merchants/${id}/${action}`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-shops'] }); toast('Done'); },
    onError: (e) => toast(errMsg(e), 'error'),
  });
  return (
    <div className="space-y-4">
      <Segmented value={status} onChange={setStatus} options={[{ value: 'pending', label: 'KYC queue' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
      {q.data?.merchants.length === 0 && <Empty icon="store" title="Nothing here" />}
      {q.data?.merchants.map((m) => (
        <Card key={m.id} className="p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="font-bold">{m.name} {m.frozen && <Pill tone="danger">frozen</Pill>}</div>
              <div className="text-sm text-ink2">{m.category} · {m.address}, {m.city}</div>
              <div className="text-sm mt-2 space-y-0.5">
                <div>Owner: <b>{m.owner?.name ?? '—'}</b> {m.owner?.phone}</div>
                <div>UPI: <b>{m.upiId}</b> · GSTIN: <b>{m.gstin ?? '—'}</b> · PAN: <b>{m.pan ?? '—'}</b></div>
                <div className="text-ink2">Signed up {fmtDate(m.createdAt, true)} · pool {formatINR(m.available + m.committed + m.owed)}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {m.status === 'pending' && <>
                <Button size="sm" onClick={() => act.mutate({ id: m.id, action: 'approve' })}>Approve</Button>
                <Button size="sm" variant="secondary" onClick={() => { const reason = prompt('Reason shown to the shop'); if (reason !== null) act.mutate({ id: m.id, action: 'reject', reason }); }}>Reject</Button>
              </>}
              {m.status === 'approved' && (m.frozen
                ? <Button size="sm" variant="secondary" onClick={() => act.mutate({ id: m.id, action: 'unfreeze' })}>Unfreeze</Button>
                : <Button size="sm" variant="danger" onClick={() => confirm(`Freeze ${m.name}? New joins and withdrawals stop; customers keep their rewards.`) && act.mutate({ id: m.id, action: 'freeze' })}>Freeze</Button>)}
              <Link to={`/proof/merchant/${m.id}`} className="text-sm underline px-2 py-2">Proof</Link>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Payouts() {
  const qc = useQueryClient();
  const toast = useToast();
  const [ref, setRef] = useState<Record<string, string>>({});
  const q = useQuery<{ payouts: any[] }>({ queryKey: ['admin-payouts'], queryFn: () => api.get('/admin/payouts') });
  const paid = useMutation({
    mutationFn: (id: string) => api.post(`/admin/payouts/${id}/paid`, { reference: ref[id] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-payouts'] }); toast('Marked paid'); },
    onError: (e) => toast(errMsg(e), 'error'),
  });
  if (q.isLoading) return <Loading />;
  if (!q.data?.payouts.length) return <Empty icon="wallet" title="No payouts yet" />;
  return (
    <Card className="divide-y divide-line">
      {q.data.payouts.map((p) => (
        <div key={p.id} className="p-4 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex-1 min-w-[200px]"><b>{p.shop}</b> → {p.upiId}<div className="text-ink2">{fmtDate(p.createdAt, true)}{p.reference ? ` · UTR ${p.reference}` : ''}</div></div>
          <b className="tabular-nums">{formatINR(p.amount)}</b>
          {p.status === 'requested' ? (
            <div className="flex gap-2"><Input placeholder="UTR / reference" value={ref[p.id] ?? ''} onChange={(e) => setRef({ ...ref, [p.id]: e.target.value })} className="h-10 w-44" /><Button size="sm" onClick={() => paid.mutate(p.id)} disabled={(ref[p.id] ?? '').length < 3}>Mark paid</Button></div>
          ) : <Pill tone="ok">{p.status}</Pill>}
        </div>
      ))}
    </Card>
  );
}

function Ledger() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'' | 'pending' | 'failed' | 'confirmed'>('');
  const q = useQuery<{ events: any[] }>({ queryKey: ['admin-ledger', status], queryFn: () => api.get(`/admin/ledger${status ? `?status=${status}` : ''}`), refetchInterval: 10_000 });
  const retry = useMutation({ mutationFn: (seq: number) => api.post(`/admin/ledger/${seq}/retry`), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-ledger'] }) });
  return (
    <div className="space-y-4">
      <Segmented value={status} onChange={setStatus} options={[{ value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' }, { value: 'confirmed', label: 'Confirmed' }]} />
      <Card className="divide-y divide-line text-sm">
        {q.data?.events.map((e) => (
          <div key={e.seq} className="p-3 flex flex-wrap items-center gap-3">
            <span className="w-12 text-ink2 tabular-nums">#{e.seq}</span>
            <span className="font-semibold flex-1 min-w-[160px]">{e.type}</span>
            <Pill tone={e.chainStatus === 'confirmed' ? 'ok' : e.chainStatus === 'failed' ? 'danger' : e.chainStatus === 'pending' ? 'warn' : 'neutral'}>{e.chainStatus}</Pill>
            <span className="text-xs text-ink2 w-32">{fmtDate(e.createdAt, true)}</span>
            {e.chainStatus === 'failed' && <Button size="sm" variant="secondary" onClick={() => retry.mutate(e.seq)}>Retry</Button>}
            {e.error && <div className="w-full text-xs text-danger break-all">{e.error}</div>}
          </div>
        ))}
        {q.data?.events.length === 0 && <div className="p-4 text-ink2">No events</div>}
      </Card>
    </div>
  );
}

function Flags() {
  const q = useQuery<{ velocity: any[]; voidRates: any[] }>({ queryKey: ['admin-flags'], queryFn: () => api.get('/admin/flags') });
  if (q.isLoading) return <Loading />;
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="font-bold">Scan velocity (≥4 scans of one customer in an hour, last 7 days)</div>
        {q.data!.velocity.length === 0 ? <p className="text-sm text-ink2 mt-2">Nothing suspicious.</p> : (
          <ul className="text-sm mt-3 space-y-1">{q.data!.velocity.map((v, i) => <li key={i}><b>{v.shop}</b>: {v.scans} scans, customer {String(v.user_id).slice(0, 8)}, {fmtDate(v.first_at, true)}</li>)}</ul>
        )}
      </Card>
      <Card className="p-5">
        <div className="font-bold">High void rates (&gt;15%, last 30 days)</div>
        {q.data!.voidRates.length === 0 ? <p className="text-sm text-ink2 mt-2">Nothing suspicious.</p> : (
          <ul className="text-sm mt-3 space-y-1">{q.data!.voidRates.map((v, i) => <li key={i}><b>{v.shop}</b>: {v.voided}/{v.visits} voided</li>)}</ul>
        )}
      </Card>
    </div>
  );
}
