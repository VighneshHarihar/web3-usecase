import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errMsg } from '../lib/api';
import { fmtDate, formatINR, rupeesToPaise } from '../lib/format';
import { Button, Card, Confirm, Field, Loading, MoneyInput, PageTitle, Pill, Stat, useToast } from '../components/ui';
import type { MerchantV } from '../lib/types';
import { PoolSplit } from './Dashboard';

export default function Pool() {
  const { t } = useTranslation();
  const m = useOutletContext<MerchantV>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [add, setAdd] = useState('5000');
  const [wd, setWd] = useState('');
  const [confirmWd, setConfirmWd] = useState(false);
  const q = useQuery<any>({ queryKey: ['pool', m.id], queryFn: () => api.get(`/m/${m.id}/pool`) });
  const topup = useMutation({
    mutationFn: () => api.post(`/m/${m.id}/pool/topup`, { amount: rupeesToPaise(add) }),
    onSuccess: (r) => nav(`/pay/${r.payment.id}?back=/m/${m.id}/pool`),
    onError: (e) => toast(errMsg(e), 'error'),
  });
  const withdraw = useMutation({
    mutationFn: () => api.post(`/m/${m.id}/pool/withdraw`, { amount: rupeesToPaise(wd) }),
    onSuccess: () => {
      setConfirmWd(false);
      setWd('');
      toast(t('m.pool.withdrawn'));
      qc.invalidateQueries({ queryKey: ['pool', m.id] });
      qc.invalidateQueries({ queryKey: ['merchant', m.id] });
    },
    onError: (e) => { setConfirmWd(false); toast(errMsg(e), 'error'); },
  });
  if (q.isLoading) return <Loading />;
  const b = q.data.balances;
  const ready = m.status === 'approved' && !m.frozen;

  return (
    <div>
      <PageTitle title={t('m.pool.title')} sub={t('m.pool.sub')} />
      <div className="px-5 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t('m.pool.available')} value={formatINR(b.available)} tone="accent" sub={t('m.pool.availableSub')} />
          <Stat label={t('m.pool.committed')} value={formatINR(b.committed)} sub={t('m.pool.committedSub')} />
          <Stat label={t('m.pool.owed')} value={formatINR(b.owed)} tone="ok" sub={t('m.pool.owedSub')} />
        </div>
        <Card className="p-5"><PoolSplit {...b} /></Card>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="p-5 space-y-3">
            <div className="font-bold">{t('m.pool.add')}</div>
            <Field label={t('m.pool.amount')} hint={m.limits.poolCap ? t('m.pool.capHint', { amount: formatINR(m.limits.poolCap) }) : undefined}>
              <MoneyInput value={add} onChange={setAdd} />
            </Field>
            <div className="flex gap-2">{['1000', '5000', '10000'].map((v) => <Button key={v} variant="soft" size="sm" onClick={() => setAdd(v)}>{formatINR(Number(v) * 100)}</Button>)}</div>
            <Button full size="lg" disabled={!ready || !rupeesToPaise(add)} loading={topup.isPending} onClick={() => topup.mutate()} icon="plus">{t('m.pool.payUpi', { amount: formatINR(rupeesToPaise(add) ?? 0) })}</Button>
            <p className="text-xs text-ink2">{t('m.pool.noFee')}</p>
          </Card>
          <Card className="p-5 space-y-3">
            <div className="font-bold">{t('m.pool.withdraw')}</div>
            <Field label={t('m.pool.amount')} hint={t('m.pool.withdrawHint', { amount: formatINR(b.available), upi: m.upiId })}>
              <MoneyInput value={wd} onChange={setWd} />
            </Field>
            <Button full size="lg" variant="secondary" disabled={!ready || !rupeesToPaise(wd)} onClick={() => setConfirmWd(true)} icon="download">{t('m.pool.withdraw')}</Button>
            <p className="text-xs text-ink2">{t('m.pool.lockedNote')}</p>
          </Card>
        </div>

        {q.data.payouts.length > 0 && (
          <Card className="p-5">
            <div className="font-bold mb-2">{t('m.pool.payouts')}</div>
            <ul className="divide-y divide-line text-sm">
              {q.data.payouts.map((p: any) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1">{fmtDate(p.createdAt, true)} → {p.upiId}</span>
                  <Pill tone={p.status === 'paid' ? 'ok' : 'warn'}>{t(`m.pool.payout.${p.status}`)}</Pill>
                  <b className="tabular-nums w-24 text-right">{formatINR(p.amount)}</b>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="p-5">
          <div className="font-bold mb-2">{t('m.pool.history')}</div>
          <ul className="divide-y divide-line text-sm">
            {q.data.movements.map((mv: any) => (
              <li key={mv.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1">{t(`m.mv.${mv.kind}`, { defaultValue: mv.kind })}</span>
                <span className="text-xs text-ink2 hidden sm:block">{t(`m.bucket.${mv.fromBucket}`)} → {t(`m.bucket.${mv.toBucket}`)}</span>
                <span className="text-xs text-ink2 w-28 text-right">{fmtDate(mv.createdAt, true)}</span>
                <b className="tabular-nums w-24 text-right">{formatINR(mv.amount)}</b>
              </li>
            ))}
            {q.data.movements.length === 0 && <li className="text-ink2 py-3">{t('m.pool.empty')}</li>}
          </ul>
          <p className="text-xs text-ink2 mt-3">{t('m.pool.feesPaid', { amount: formatINR(q.data.feesPaid) })}</p>
        </Card>
      </div>
      <Confirm open={confirmWd} onClose={() => setConfirmWd(false)} title={t('m.pool.withdrawTitle')} body={t('m.pool.withdrawBody', { amount: formatINR(rupeesToPaise(wd) ?? 0), upi: m.upiId })} confirmLabel={t('m.pool.withdraw')} loading={withdraw.isPending} onConfirm={() => withdraw.mutate()} />
    </div>
  );
}
