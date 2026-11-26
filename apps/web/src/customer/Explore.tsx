import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useGeo } from '../lib/geo';
import { Icon } from '../components/Icon';
import { Empty, ErrorBox, Input, Loading, PageTitle } from '../components/ui';
import type { OfferCard } from '../lib/types';
import { OfferRow } from './parts';

const CATS = ['all', 'grocery', 'food', 'coffee', 'bakery', 'retail', 'pharmacy', 'salon', 'services'] as const;

export default function Explore() {
  const { t } = useTranslation();
  const geo = useGeo();
  const [cat, setCat] = useState<(typeof CATS)[number]>('all');
  const [q, setQ] = useState('');
  const params = new URLSearchParams();
  if (geo.pos) {
    params.set('lat', String(geo.pos.lat));
    params.set('lng', String(geo.pos.lng));
  }
  if (cat !== 'all') params.set('category', cat);
  if (q.trim().length >= 2) params.set('q', q.trim());
  const list = useQuery<{ offers: OfferCard[] }>({ queryKey: ['offers', params.toString()], queryFn: () => api.get(`/offers?${params}`) });

  return (
    <div>
      <PageTitle title={t('explore.title')} sub={geo.pos ? t('explore.nearYou') : t('explore.all')} />
      <div className="px-5 space-y-3">
        <div className="relative">
          <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('explore.search')} className="pl-10" aria-label={t('explore.search')} />
        </div>
        {!geo.pos && (
          <button onClick={geo.request} className="text-sm font-semibold inline-flex items-center gap-1.5 px-3 h-10 rounded-full bg-alt">
            <Icon name="pin" size={16} />{geo.status === 'denied' ? t('explore.locationOff') : t('home.useLocation')}
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-5 py-4" role="tablist">
        {CATS.map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={`h-10 px-4 rounded-full text-sm font-semibold whitespace-nowrap ${cat === c ? 'bg-ink text-white' : 'bg-surface shadow-[var(--shadow-card)]'}`}>
            {t(`category.${c}`)}
          </button>
        ))}
      </div>
      <div className="px-5 space-y-3">
        {list.isLoading && <Loading />}
        {list.error && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.offers.length === 0 && <Empty icon="store" title={t('explore.none')} body={t('explore.noneBody')} />}
        {list.data?.offers.map((o) => <OfferRow key={o.id} o={o} />)}
      </div>
    </div>
  );
}
