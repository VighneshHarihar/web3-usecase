import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useMe } from '../lib/session';
import { formatINR } from '../lib/format';
import { useGeo } from '../lib/geo';
import { Icon } from '../components/Icon';
import { Card, Empty, ErrorBox, LinkButton, Loading } from '../components/ui';
import type { EnrolmentV, OfferCard, RewardV } from '../lib/types';
import { ActiveHero, OfferTile, RewardCard } from './parts';

export default function Home() {
  const { t } = useTranslation();
  const me = useMe();
  const geo = useGeo();
  const home = useQuery<{ enrolments: EnrolmentV[]; rewards: RewardV[]; unread: number }>({ queryKey: ['home'], queryFn: () => api.get('/c/home'), refetchInterval: 30_000 });
  const offers = useQuery<{ offers: OfferCard[] }>({
    queryKey: ['offers', geo.pos?.lat, geo.pos?.lng],
    queryFn: () => api.get(`/offers${geo.pos ? `?lat=${geo.pos.lat}&lng=${geo.pos.lng}` : ''}`),
  });
  if (home.isLoading) return <Loading />;
  if (home.error) return <ErrorBox error={home.error} onRetry={() => home.refetch()} />;
  const h = home.data!;
  const name = me.data?.user.name?.split(' ')[0];
  const ready = h.rewards.length;
  const joined = new Set(h.enrolments.map((e) => e.offer.id));
  const nearby = (offers.data?.offers ?? []).filter((o) => !joined.has(o.id)).slice(0, 8);

  return (
    <div className="pt-4">
      <header className="flex items-center gap-3 px-5 pb-4">
        <Link to="/profile" className="w-10 h-10 rounded-full bg-ink text-white grid place-items-center font-bold text-sm" aria-label={t('nav.profile')}>
          {(name ?? '•').slice(0, 1).toUpperCase()}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[17px] tracking-tight">{name ? t('home.hello', { name }) : t('home.helloAnon')}</div>
          <div className="text-xs text-ink2">{t('home.sub', { count: offers.data?.offers.length ?? 0 })}</div>
        </div>
        <Link to="/alerts" className="relative w-10 h-10 rounded-full bg-alt grid place-items-center" aria-label={t('nav.alerts')}>
          <Icon name="bell" size={20} />
          {h.unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-accent-strong text-white text-[11px] font-bold grid place-items-center">{h.unread}</span>}
        </Link>
      </header>

      {ready > 0 && (
        <div className="px-5 mb-4">
          <Link to="/rewards" className="flex items-center gap-3 p-4 rounded-[20px] bg-ok-soft text-ok">
            <Icon name="gift" size={26} />
            <div className="flex-1">
              <div className="font-bold">{t('home.rewardsReady', { count: ready })}</div>
              <div className="text-sm opacity-90">{t('home.showQr')}</div>
            </div>
            <Icon name="chevron" />
          </Link>
        </div>
      )}

      {h.enrolments.length > 0 ? (
        <section className="px-5 space-y-3 mb-6">
          {h.enrolments.map((e) => <ActiveHero key={e.id} e={e} />)}
        </section>
      ) : (
        <div className="px-5 mb-6">
          <Card tone="alt" className="p-5">
            <div className="font-bold">{t('home.noActiveTitle')}</div>
            <p className="text-sm text-ink2 mt-1 leading-relaxed">{t('home.noActiveBody')}</p>
            <LinkButton to="/explore" size="sm" className="mt-3" icon="search">{t('home.findOffers')}</LinkButton>
          </Card>
        </div>
      )}

      <section className="mb-6">
        <div className="flex items-baseline justify-between px-5 mb-2.5">
          <h2 className="text-lg font-bold tracking-tight">{geo.pos ? t('home.nearby') : t('home.offers')}</h2>
          <Link to="/explore" className="text-sm font-semibold text-ink2">{t('common.seeAll')}</Link>
        </div>
        {!geo.pos && geo.status !== 'denied' && (
          <div className="px-5 mb-3">
            <button onClick={geo.request} className="text-sm font-semibold text-ink inline-flex items-center gap-1.5 px-3 h-10 rounded-full bg-alt"><Icon name="pin" size={16} />{t('home.useLocation')}</button>
          </div>
        )}
        {nearby.length ? (
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-5 pb-2">
            {nearby.map((o) => <OfferTile key={o.id} o={o} />)}
          </div>
        ) : (
          !offers.isLoading && <Empty icon="store" title={t('home.noOffers')} body={t('home.noOffersBody')} />
        )}
      </section>

      {h.rewards.length > 0 && (
        <section className="px-5 mb-6">
          <h2 className="text-lg font-bold tracking-tight mb-2.5">{t('home.yourRewards')}</h2>
          <div className="space-y-3">{h.rewards.slice(0, 3).map((r) => <RewardCard key={r.id} r={r} compact />)}</div>
        </section>
      )}

      <div className="px-5">
        <Link to="/how-it-works" className="flex items-center gap-3 p-4 rounded-[18px] bg-alt">
          <div className="w-10 h-10 rounded-xl bg-surface grid place-items-center text-ok"><Icon name="shield" size={20} /></div>
          <div className="flex-1">
            <div className="text-sm font-bold">{t('home.trustTitle')}</div>
            <div className="text-xs text-ink2 mt-0.5 leading-relaxed">{t('home.trustBody')}</div>
          </div>
        </Link>
        <p className="text-center text-xs text-ink2 mt-4">{t('home.balanceNote', { amount: formatINR(h.rewards.reduce((s, r) => s + r.remaining, 0)) })}</p>
      </div>
    </div>
  );
}
