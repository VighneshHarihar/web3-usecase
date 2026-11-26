import { Link, useOutletContext } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { formatINR, timeAgo } from '../lib/format';
import { Icon } from '../components/Icon';
import { Bar, Card, LinkButton, Loading, PageTitle, Stat } from '../components/ui';
import type { MerchantV } from '../lib/types';

export function PoolSplit({ available, committed, owed }: { available: number; committed: number; owed: number }) {
  const { t } = useTranslation();
  const total = available + committed + owed || 1;
  const segs = [
    { v: available, c: 'var(--color-accent)', l: t('m.pool.available') },
    { v: committed, c: 'var(--color-ink)', l: t('m.pool.committed') },
    { v: owed, c: 'var(--color-ok)', l: t('m.pool.owed') },
  ];
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-alt" role="img" aria-label={segs.map((s) => `${s.l} ${formatINR(s.v)}`).join(', ')}>
        {segs.map((s) => <div key={s.l} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-xs">
        {segs.map((s) => (
          <span key={s.l} className="inline-flex items-center gap-1.5 text-ink2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.c }} />{s.l} <b className="text-ink tabular-nums">{formatINR(s.v)}</b></span>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const m = useOutletContext<MerchantV>();
  const q = useQuery<any>({ queryKey: ['dash', m.id], queryFn: () => api.get(`/m/${m.id}/dashboard`), refetchInterval: 30_000 });
  if (q.isLoading) return <Loading />;
  const d = q.data;
  const k = d?.kpis ?? {};
  const f = d?.funnel ?? { joined: 0, progressing: 0, completed: 0, redeemed: 0 };
  const steps = [
    { done: m.status === 'approved', label: t('m.dash.check1'), to: `/m/${m.id}/settings` },
    { done: m.available + m.committed > 0, label: t('m.dash.check2'), to: `/m/${m.id}/pool` },
    { done: (k.liveOffers ?? 0) > 0, label: t('m.dash.check3'), to: `/m/${m.id}/offers/new` },
    { done: false, label: t('m.dash.check4'), to: `/m/${m.id}/poster` },
  ];
  const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);

  return (
    <div>
      <PageTitle title={t('m.dash.title')} sub={t('m.dash.sub')} right={<LinkButton to={`/m/${m.id}/offers/new`} size="sm" icon="plus">{t('m.dash.create')}</LinkButton>} />
      <div className="px-5 space-y-5">
        {steps.some((s) => !s.done) && (
          <Card className="p-4">
            <div className="font-bold mb-2">{t('m.dash.checklist')}</div>
            <ul className="space-y-1">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link to={s.to} className="flex items-center gap-3 py-2">
                    <span className={`w-6 h-6 rounded-full grid place-items-center ${s.done ? 'bg-ok text-white' : 'border-2 border-line'}`}>{s.done && <Icon name="check" size={14} stroke={3} />}</span>
                    <span className={`text-sm ${s.done ? 'text-ink2 line-through' : 'font-semibold'}`}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label={t('m.dash.inProgress')} value={k.inProgress ?? 0} sub={t('m.dash.liveOffers', { count: k.liveOffers ?? 0 })} />
          <Stat label={t('m.pool.available')} value={formatINR(k.available ?? 0)} tone="accent" sub={t('m.dash.reserved', { amount: formatINR(k.committed ?? 0) })} />
          <Stat label={t('m.dash.repeat')} value={pct(k.repeatRate)} sub={t('m.dash.customers30', { count: k.customers30d ?? 0 })} />
          <Stat label={t('m.dash.redeemed')} value={formatINR(k.redeemedThisMonth ?? 0)} sub={t('m.dash.sales', { amount: formatINR(k.trackedSalesThisMonth ?? 0) })} />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <div className="font-bold">{t('m.dash.funnel')}</div>
            <div className="mt-4 space-y-3.5">
              {[['joined', f.joined], ['progressing', f.progressing], ['completed', f.completed], ['redeemed', f.redeemed]].map(([key, v]) => (
                <div key={key as string}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-ink2">{t(`m.dash.f.${key}`)}</span><b className="tabular-nums">{v as number}</b></div>
                  <Bar value={f.joined ? (v as number) / f.joined : 0} color={key === 'redeemed' ? 'var(--color-ok)' : undefined} />
                </div>
              ))}
            </div>
            <div className="text-xs text-ink2 mt-4">{t('m.dash.completion', { pct: pct(k.completionRate), days: k.avgDaysToComplete ? Math.round(k.avgDaysToComplete * 10) / 10 : '—' })}</div>
          </Card>
          <Card className="p-5">
            <div className="font-bold mb-3">{t('m.dash.pool')}</div>
            <PoolSplit available={k.available ?? 0} committed={k.committed ?? 0} owed={k.owed ?? 0} />
            <p className="text-xs text-ink2 mt-4 leading-relaxed">{t('m.dash.poolNote')}</p>
            <LinkButton to={`/m/${m.id}/pool`} variant="secondary" size="sm" className="mt-3">{t('m.dash.managePool')}</LinkButton>
          </Card>
        </div>

        <Card className="p-5">
          <div className="font-bold mb-2">{t('m.dash.activity')}</div>
          {d?.activity?.length ? (
            <ul className="divide-y divide-line">
              {d.activity.map((a: any, i: number) => (
                <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                  <Icon name={a.kind.startsWith('visit') ? 'receipt' : 'wallet'} size={18} className="text-ink2" />
                  <span className="flex-1">{t(`m.act.${a.kind}`, { defaultValue: a.kind })}{a.customer ? ` · ${a.customer.name ?? a.customer.ref}` : ''}</span>
                  <b className="tabular-nums">{formatINR(a.amount)}</b>
                  <span className="text-xs text-ink2 w-24 text-right">{timeAgo(a.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-ink2 py-4">{t('m.dash.noActivity')}</div>
          )}
        </Card>
      </div>
    </div>
  );
}
