import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { formatINR } from '../lib/format';
import { Card, Empty, ErrorBox, LinkButton, Loading, PageTitle, Segmented } from '../components/ui';
import type { RewardV } from '../lib/types';
import { RewardCard } from './parts';
import Activity from './Activity';

export default function Rewards() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'rewards' | 'history'>('rewards');
  const q = useQuery<{ rewards: RewardV[] }>({ queryKey: ['rewards'], queryFn: () => api.get('/c/rewards') });
  const active = q.data?.rewards.filter((r) => r.status === 'active') ?? [];
  const past = q.data?.rewards.filter((r) => r.status !== 'active') ?? [];
  const credit = active.filter((r) => r.kind === 'credit').reduce((s, r) => s + r.remaining, 0);
  const coupons = active.filter((r) => r.kind === 'percent').length;

  return (
    <div>
      <PageTitle title={t('rewards.title')} />
      <div className="px-5">
        <Card tone="ink" className="p-5">
          <div className="text-xs uppercase tracking-wider text-white/60 font-semibold">{t('rewards.ready')}</div>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-4xl font-bold tracking-tight tabular-nums">{formatINR(credit)}</span>
            {coupons > 0 && <span className="text-white/70 text-sm">+ {t('rewards.coupons', { count: coupons })}</span>}
          </div>
          <p className="text-white/70 text-sm mt-2">{t('rewards.howToUse')}</p>
          <LinkButton to="/qr" variant="accent" className="mt-4" icon="qr">{t('nav.qr')}</LinkButton>
        </Card>
        <div className="mt-5">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'rewards', label: t('rewards.tabRewards') }, { value: 'history', label: t('rewards.tabHistory') }]} />
        </div>
      </div>
      {tab === 'rewards' ? (
        <div className="px-5 mt-4 space-y-3">
          {q.isLoading && <Loading />}
          {q.error && <ErrorBox error={q.error} />}
          {q.data && active.length === 0 && <Empty icon="gift" title={t('rewards.none')} body={t('rewards.noneBody')} action={<LinkButton to="/explore" size="sm">{t('home.findOffers')}</LinkButton>} />}
          {active.map((r) => <RewardCard key={r.id} r={r} />)}
          {past.length > 0 && <h2 className="font-bold pt-4">{t('rewards.past')}</h2>}
          {past.map((r) => <RewardCard key={r.id} r={r} />)}
        </div>
      ) : (
        <Activity embedded />
      )}
    </div>
  );
}
