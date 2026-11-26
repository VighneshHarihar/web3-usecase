import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errMsg } from '../lib/api';
import { formatINR } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, Card, ErrorBox, Loading, PageTitle } from '../components/ui';

declare global {
  interface Window { Razorpay?: any }
}

function loadRazorpay(): Promise<void> {
  return new Promise((res, rej) => {
    if (window.Razorpay) return res();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => res();
    s.onerror = () => rej(new Error('Could not load the payment page'));
    document.body.appendChild(s);
  });
}

/** Money in on familiar rails: UPI via Razorpay, or the sandbox simulator in test mode. */
export default function PayPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const back = params.get('back') ?? '/merchant';
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery<any>({ queryKey: ['payment', id], queryFn: () => api.get(`/payments/${id}`) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { payment: p, merchantName, razorpayKeyId } = q.data;

  async function done(ok: boolean) {
    await qc.invalidateQueries();
    if (ok) nav(`${back}${back.includes('?') ? '&' : '?'}paid=1`, { replace: true });
  }

  async function confirm(body: object) {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post(`/payments/${id}/confirm`, body);
      if (r.payment.status === 'paid') await done(true);
      else { setErr(t('pay.failed')); q.refetch(); }
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function razorpay() {
    try {
      await loadRazorpay();
      const rz = new window.Razorpay({
        key: razorpayKeyId, order_id: p.providerOrderId, amount: p.amount, currency: 'INR', name: 'LoyalLink', description: merchantName,
        handler: (resp: any) => confirm(resp),
        theme: { color: '#1F1B16' },
      });
      rz.open();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title={t('pay.title')} back={back} />
      <div className="px-5 space-y-4">
        <Card className="p-6 text-center">
          <div className="text-sm text-ink2">{p.purpose === 'plan_pro' ? t('pay.pro') : t('pay.topup', { shop: merchantName })}</div>
          <div className="text-4xl font-bold tracking-tight mt-2 tabular-nums">{formatINR(p.amount)}</div>
          <div className="text-xs text-ink2 mt-2">{t('pay.noFee')}</div>
        </Card>
        {p.status === 'paid' ? (
          <Card className="p-5 bg-ok-soft text-ok font-semibold flex items-center gap-2"><Icon name="checkCircle" />{t('pay.paid')}</Card>
        ) : p.provider === 'sandbox' ? (
          <>
            <div className="p-3 rounded-xl bg-warn-soft text-warn text-sm"><b>{t('pay.testMode')}</b> {t('pay.testBody')}</div>
            <Button size="lg" full loading={busy} onClick={() => confirm({ simulate: 'success' })} icon="check">{t('pay.payUpi', { amount: formatINR(p.amount) })}</Button>
            <Button variant="ghost" full onClick={() => confirm({ simulate: 'failure' })}>{t('pay.simulateFail')}</Button>
          </>
        ) : (
          <Button size="lg" full loading={busy} onClick={razorpay}>{t('pay.payUpi', { amount: formatINR(p.amount) })}</Button>
        )}
        {p.status === 'failed' && <div className="text-sm text-danger">{t('pay.failed')}</div>}
        {err && <div className="text-sm text-danger" role="alert">{err}</div>}
        {p.status === 'paid' && <Button full onClick={() => done(true)}>{t('common.continue')}</Button>}
      </div>
    </div>
  );
}
