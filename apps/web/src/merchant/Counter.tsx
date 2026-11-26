import { useCallback, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { computeRedemption } from '@loyallink/shared/core';
import { api, errMsg } from '../lib/api';
import { formatINR, lang, rupeesToPaise, timeAgo } from '../lib/format';
import { Icon } from '../components/Icon';
import { Scanner } from '../components/Scanner';
import { Bar, Button, Card, Confirm, Input, MoneyInput, PageTitle, Pill, Segmented, useToast } from '../components/ui';
import type { EnrolmentV, MerchantV, RewardV } from '../lib/types';

type Lookup = {
  sessionId: string; expiresAt: string;
  customer: { ref: string; name: string | null; phone: string };
  enrolments: EnrolmentV[]; rewards: RewardV[]; notJoined: { id: string; title: string }[];
};
type Outcome = { offerTitle: string; counted: boolean; reason?: string; completed: boolean; purchases: number; minPurchases: number; spend: number; minTotalSpend: number; rewardText?: string };

/** M6: the counter. Designed for one-handed use while serving a queue. */
export default function Counter() {
  const { t } = useTranslation();
  const l = lang();
  const m = useOutletContext<MerchantV>();
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<'camera' | 'code'>('code');
  const [code, setCode] = useState('');
  const [s, setS] = useState<Lookup | null>(null);
  const [bill, setBill] = useState('');
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [redeemFor, setRedeemFor] = useState<RewardV | null>(null);
  const [redeemBill, setRedeemBill] = useState('');
  const [redeemed, setRedeemed] = useState<{ discount: number; payable: number } | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);

  const recent = useQuery<{ visits: { id: string; amount: number; at: string; voidedAt: string | null; customer: { name: string | null; ref: string }; staff: string | null; canVoid: boolean }[] }>({
    queryKey: ['recent', m.id],
    queryFn: () => api.get(`/m/${m.id}/counter/recent`),
  });

  const lookup = useMutation({
    mutationFn: (c: string) => api.post<Lookup>(`/m/${m.id}/counter/lookup`, { code: c }),
    onSuccess: (r) => { setS(r); setOutcomes(null); setRedeemed(null); setBill(''); setCode(''); },
    onError: (e) => { toast(errMsg(e), 'error'); setMode('code'); },
  });
  const purchase = useMutation({
    mutationFn: (amount: number) => api.post<Lookup & { outcomes: Outcome[] }>(`/m/${m.id}/counter/purchase`, { sessionId: s!.sessionId, amount }),
    onSuccess: (r) => {
      setS({ ...s!, enrolments: r.enrolments, rewards: r.rewards, notJoined: r.notJoined });
      setOutcomes(r.outcomes);
      setBill('');
      qc.invalidateQueries({ queryKey: ['recent', m.id] });
      qc.invalidateQueries({ queryKey: ['dash', m.id] });
      if (r.outcomes.some((o) => o.completed)) navigator.vibrate?.([60, 40, 60]);
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });
  const redeem = useMutation({
    mutationFn: () => api.post<Lookup & { discount: number; payable: number }>(`/m/${m.id}/counter/redeem`, { sessionId: s!.sessionId, rewardId: redeemFor!.id, billAmount: rupeesToPaise(redeemBill) }),
    onSuccess: (r) => {
      setS({ ...s!, enrolments: r.enrolments, rewards: r.rewards, notJoined: r.notJoined });
      setRedeemed({ discount: r.discount, payable: r.payable });
      setRedeemFor(null);
      setRedeemBill('');
      qc.invalidateQueries({ queryKey: ['dash', m.id] });
      qc.invalidateQueries({ queryKey: ['merchant', m.id] });
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });
  const doVoid = useMutation({
    mutationFn: (id: string) => api.post(`/m/${m.id}/counter/visits/${id}/void`),
    onSuccess: () => { toast(t('m.counter.voided')); setVoidId(null); qc.invalidateQueries({ queryKey: ['recent', m.id] }); },
    onError: (e) => { toast(errMsg(e), 'error'); setVoidId(null); },
  });

  const onScan = useCallback((text: string) => lookup.mutate(text), [lookup]);
  const onCamError = useCallback((msg: string) => { toast(msg, 'error'); setMode('code'); }, [toast]);
  const preview = useMemo(() => {
    const b = rupeesToPaise(redeemBill);
    if (!redeemFor || !b) return null;
    return computeRedemption({ kind: redeemFor.kind, percentBps: redeemFor.percentBps, value: redeemFor.value, remaining: redeemFor.remaining, feeBps: 0 }, b);
  }, [redeemFor, redeemBill]);

  const reset = () => { setS(null); setOutcomes(null); setRedeemed(null); setRedeemFor(null); };
  const notReady = m.status !== 'approved';

  return (
    <div>
      <PageTitle title={t('m.counter.title')} sub={t('m.counter.sub')} />
      <div className="px-5 grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-4">
          {!s && (
            <Card className="p-5 space-y-4">
              <Segmented value={mode} onChange={setMode} options={[{ value: 'code', label: t('m.counter.typeCode') }, { value: 'camera', label: t('m.counter.scan') }]} />
              {mode === 'camera' ? (
                <Scanner onResult={onScan} onError={onCamError} />
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6) lookup.mutate(code); }} className="space-y-3">
                  <label className="block text-sm font-semibold" htmlFor="code">{t('m.counter.codeLabel')}</label>
                  <Input id="code" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123 456" className="text-center text-3xl tracking-[0.4em] font-bold h-16" disabled={notReady} />
                  <Button type="submit" size="lg" full disabled={code.length !== 6 || notReady} loading={lookup.isPending} icon="user">{t('m.counter.find')}</Button>
                </form>
              )}
              <p className="text-xs text-ink2 leading-relaxed">{t('m.counter.howTo')}</p>
            </Card>
          )}

          {s && (
            <>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-ink text-white grid place-items-center font-bold">{(s.customer.name ?? '#').slice(0, 1)}</div>
                  <div className="flex-1">
                    <div className="font-bold text-lg">{s.customer.name ?? t('m.counter.customer')} <span className="text-ink2 font-medium text-sm">#{s.customer.ref}</span></div>
                    <div className="text-sm text-ink2">{s.customer.phone}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={reset} icon="close">{t('m.counter.done')}</Button>
                </div>
                {s.enrolments.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {s.enrolments.map((e) => (
                      <div key={e.id} className="p-3 rounded-xl bg-alt">
                        <div className="flex justify-between text-sm"><b>{e.offer.title}</b><span className="tabular-nums">{e.purchases}/{e.offer.terms.minPurchases}</span></div>
                        <div className="mt-2"><Bar value={e.progress.overall} /></div>
                        {e.offer.terms.minTotalSpend > 0 && <div className="text-xs text-ink2 mt-1.5">{formatINR(e.spend)} / {formatINR(e.offer.terms.minTotalSpend)}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {s.notJoined.length > 0 && (
                  <div className="mt-3 text-sm p-3 rounded-xl bg-accent-soft text-accent-ink">{t('m.counter.notJoined', { offers: s.notJoined.map((o) => o.title).join(', ') })}</div>
                )}
              </Card>

              {s.rewards.length > 0 && !redeemFor && (
                <Card className="p-5">
                  <div className="font-bold flex items-center gap-2"><Icon name="gift" className="text-ok" />{t('m.counter.hasRewards', { count: s.rewards.length })}</div>
                  <div className="mt-3 space-y-2">
                    {s.rewards.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-ok-soft">
                        <div className="flex-1 text-sm"><b>{r.text[l]}</b>{r.kind === 'credit' && <div className="text-ok">{t('rewards.left', { amount: formatINR(r.remaining) })}</div>}</div>
                        <Button size="sm" onClick={() => { setRedeemFor(r); setRedeemed(null); }}>{t('m.counter.use')}</Button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {redeemFor && (
                <Card className="p-5 space-y-3">
                  <div className="font-bold">{t('m.counter.useReward', { reward: redeemFor.text[l] })}</div>
                  <MoneyInput value={redeemBill} onChange={setRedeemBill} placeholder={t('m.counter.billPh')} autoFocus aria-label={t('m.counter.billTotal')} />
                  {preview && (
                    <div className="p-4 rounded-xl bg-alt text-sm space-y-1">
                      <div className="flex justify-between"><span>{t('m.counter.discount')}</span><b className="text-ok tabular-nums">−{formatINR(preview.used)}</b></div>
                      <div className="flex justify-between text-base"><span>{t('m.counter.customerPays')}</span><b className="tabular-nums">{formatINR(preview.payable)}</b></div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setRedeemFor(null)}>{t('common.cancel')}</Button>
                    <Button full disabled={!preview} loading={redeem.isPending} onClick={() => redeem.mutate()} icon="check">{t('m.counter.applyDiscount')}</Button>
                  </div>
                </Card>
              )}

              {redeemed && (
                <Card className="p-5 bg-ok-soft animate-rise">
                  <div className="text-ok font-bold text-lg flex items-center gap-2"><Icon name="checkCircle" />{t('m.counter.giveOff', { amount: formatINR(redeemed.discount) })}</div>
                  <div className="text-sm mt-1">{t('m.counter.collect', { amount: formatINR(redeemed.payable) })}</div>
                  <div className="text-xs text-ink2 mt-2">{t('m.counter.reimbursed')}</div>
                </Card>
              )}

              {!redeemFor && (
                <Card className="p-5 space-y-3">
                  <div className="font-bold">{t('m.counter.recordTitle')}</div>
                  <form onSubmit={(e) => { e.preventDefault(); const a = rupeesToPaise(bill); if (a) purchase.mutate(a); }} className="space-y-3">
                    <MoneyInput value={bill} onChange={setBill} placeholder={t('m.counter.billPh')} aria-label={t('m.counter.billTotal')} />
                    <Button type="submit" size="lg" full disabled={!rupeesToPaise(bill)} loading={purchase.isPending} icon="receipt">{t('m.counter.record')}</Button>
                  </form>
                  {outcomes && (
                    <div className="space-y-2 animate-rise">
                      {outcomes.length === 0 && <div className="text-sm text-ink2">{t('m.counter.noActive')}</div>}
                      {outcomes.map((o, i) => (
                        <div key={i} className={`p-3 rounded-xl text-sm ${o.completed ? 'bg-ok-soft text-ok' : o.counted ? 'bg-alt' : 'bg-warn-soft text-warn'}`}>
                          <b>{o.offerTitle}: </b>
                          {o.completed ? t('m.counter.unlocked', { reward: o.rewardText }) : o.counted ? t('m.counter.counted', { n: o.purchases, total: o.minPurchases }) : t(`m.counter.reason.${o.reason}`)}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
        </div>

        <Card className="p-5">
          <div className="font-bold mb-2">{t('m.counter.recent')}</div>
          <ul className="divide-y divide-line">
            {recent.data?.visits.map((v) => (
              <li key={v.id} className={`flex items-center gap-2 py-2.5 text-sm ${v.voidedAt ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{v.customer.name ?? `#${v.customer.ref}`} {v.voidedAt && <Pill>{t('m.counter.voidedPill')}</Pill>}</div>
                  <div className="text-xs text-ink2">{timeAgo(v.at)}{v.staff ? ` · ${v.staff}` : ''}</div>
                </div>
                <b className="tabular-nums">{formatINR(v.amount)}</b>
                {v.canVoid && <button onClick={() => setVoidId(v.id)} className="text-xs font-semibold text-danger px-2 py-2 rounded-lg hover:bg-danger-soft" aria-label={t('m.counter.void')}>{t('m.counter.void')}</button>}
              </li>
            ))}
            {recent.data?.visits.length === 0 && <li className="text-sm text-ink2 py-3">{t('m.counter.noRecent')}</li>}
          </ul>
        </Card>
      </div>
      <Confirm open={!!voidId} onClose={() => setVoidId(null)} title={t('m.counter.voidTitle')} body={t('m.counter.voidBody')} confirmLabel={t('m.counter.void')} danger loading={doVoid.isPending} onConfirm={() => voidId && doVoid.mutate(voidId)} />
    </div>
  );
}
