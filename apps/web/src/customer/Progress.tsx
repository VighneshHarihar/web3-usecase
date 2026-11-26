import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errMsg } from '../lib/api';
import { daysLeft, fmtDate, formatINR, lang } from '../lib/format';
import { Icon, ShopGlyph } from '../components/Icon';
import { Bar, Card, Confirm, ErrorBox, LinkButton, Loading, PageTitle, Pill, Ring, TrustBadge, useToast } from '../components/ui';
import type { EnrolmentV, RewardV } from '../lib/types';
import { nextStep, RewardCard } from './parts';

export default function Progress() {
  const { id } = useParams();
  const { t } = useTranslation();
  const l = lang();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery<{ enrolment: EnrolmentV; purchases: { id: string; amount: number; at: string; voided: boolean }[]; reward: RewardV | null }>({
    queryKey: ['enrolment', id],
    queryFn: () => api.get(`/c/enrolments/${id}`),
    refetchInterval: 15_000,
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/c/enrolments/${id}/cancel`),
    onSuccess: () => {
      toast(t('progress.cancelled'));
      qc.invalidateQueries({ queryKey: ['home'] });
      nav('/', { replace: true });
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { enrolment: e, purchases, reward } = q.data!;
  const o = e.offer;
  const d = daysLeft(e.deadline);
  const active = e.status === 'active';

  return (
    <div>
      <PageTitle title={o.title} sub={o.shop.name} back="/" />
      <div className="px-5 space-y-5">
        <Card className="p-6 flex flex-col items-center text-center">
          <Ring value={e.status === 'completed' ? 1 : e.progress.overall} size={148} stroke={12}>
            <div>
              <div className="text-3xl font-bold tabular-nums">{e.purchases}<span className="text-ink2 text-xl">/{o.terms.minPurchases}</span></div>
              <div className="text-xs text-ink2 font-semibold">{t('progress.visits')}</div>
            </div>
          </Ring>
          {active ? (
            <>
              <div className="text-lg font-bold tracking-tight mt-4">{nextStep(e, t)} {t('progress.toUnlock')} {o.text[l].reward}</div>
              <div className="mt-2"><Pill tone={d <= 2 ? 'warn' : 'neutral'} icon="clock">{t('progress.endsOn', { date: fmtDate(e.deadline), count: d })}</Pill></div>
            </>
          ) : (
            <div className="mt-4"><Pill tone={e.status === 'completed' ? 'ok' : 'neutral'}>{t(`progress.status.${e.status}`)}</Pill></div>
          )}
          {o.terms.minTotalSpend > 0 && (
            <div className="w-full mt-5 text-left">
              <div className="flex justify-between text-sm mb-1.5"><span className="text-ink2">{t('progress.spent')}</span><b className="tabular-nums">{formatINR(e.spend)} / {formatINR(o.terms.minTotalSpend)}</b></div>
              <Bar value={e.progress.spend} />
            </div>
          )}
        </Card>

        {reward && <RewardCard r={reward} />}

        {active && (
          <>
            <TrustBadge prominent to={`/proof/enrolment/${e.id}`} label={t('trust.reservedLong', { amount: formatINR(e.reserved), date: fmtDate(e.deadline) })} />
            <LinkButton to="/qr" size="lg" full icon="qr">{t('progress.showQr')}</LinkButton>
          </>
        )}

        <section>
          <h2 className="font-bold mb-2">{t('progress.timeline')}</h2>
          <Card className="divide-y divide-line">
            <div className="flex items-center gap-3 p-4">
              <ShopGlyph category={o.shop.category} size={36} />
              <div className="flex-1 text-sm"><div className="font-semibold">{t('progress.joined')}</div><div className="text-ink2">{fmtDate(e.startedAt, true)}</div></div>
            </div>
            {purchases.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 p-4 ${p.voided ? 'opacity-50' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-ok-soft text-ok grid place-items-center"><Icon name="check" size={18} stroke={2.4} /></div>
                <div className="flex-1 text-sm">
                  <div className="font-semibold">{t('progress.purchaseN', { n: i + 1 })} {p.voided && <Pill className="ml-1">{t('progress.voided')}</Pill>}</div>
                  <div className="text-ink2">{fmtDate(p.at, true)}</div>
                </div>
                <b className="tabular-nums">{formatINR(p.amount)}</b>
              </div>
            ))}
            {purchases.length === 0 && <div className="p-4 text-sm text-ink2">{t('progress.noPurchases')}</div>}
          </Card>
        </section>

        {active && (
          <button onClick={() => setConfirm(true)} className="block mx-auto text-sm text-ink2 underline py-3">{t('progress.cancel')}</button>
        )}
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title={t('progress.cancelTitle')} body={t('progress.cancelBody')} confirmLabel={t('progress.cancelConfirm')} danger loading={cancel.isPending} onConfirm={() => cancel.mutate()} />
    </div>
  );
}
