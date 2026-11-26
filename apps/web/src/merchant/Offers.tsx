import { Link, useOutletContext } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { lang } from '../lib/format';
import { Icon } from '../components/Icon';
import { Card, Empty, LinkButton, Loading, PageTitle, Pill } from '../components/ui';
import type { MerchantV, OfferCard } from '../lib/types';

export const statusTone = (s: string) => (s === 'live' ? 'ok' : s === 'paused' ? 'warn' : s === 'draft' ? 'accent' : 'neutral') as 'ok' | 'warn' | 'accent' | 'neutral';

export default function Offers() {
  const { t } = useTranslation();
  const l = lang();
  const m = useOutletContext<MerchantV>();
  const q = useQuery<{ offers: OfferCard[] }>({ queryKey: ['moffers', m.id], queryFn: () => api.get(`/m/${m.id}/offers`) });
  return (
    <div>
      <PageTitle title={t('m.offers.title')} sub={t('m.offers.sub')} right={<LinkButton to={`/m/${m.id}/offers/new`} size="sm" icon="plus">{t('m.dash.create')}</LinkButton>} />
      <div className="px-5 space-y-3">
        {q.isLoading && <Loading />}
        {q.data?.offers.length === 0 && <Empty icon="tag" title={t('m.offers.none')} body={t('m.offers.noneBody')} action={<LinkButton to={`/m/${m.id}/offers/new`} icon="plus">{t('m.dash.create')}</LinkButton>} />}
        {q.data?.offers.map((o) => (
          <Link key={o.id} to={`/m/${m.id}/offers/${o.id}`} className="block">
            <Card className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><b className="truncate">{o.title}</b><Pill tone={statusTone(o.status)}>{t(`m.offerStatus.${o.status}`)}</Pill></div>
                <div className="text-sm text-ink2 mt-1 leading-snug">{o.text[l].condition} → {o.text[l].reward}</div>
                <div className="text-xs text-ink2 mt-2 flex gap-3">
                  <span>{t('m.offers.active', { count: o.stats?.active ?? 0 })}</span>
                  <span>{t('m.offers.completed', { count: o.stats?.completed ?? 0 })}</span>
                  {o.status === 'live' && <span>{t('m.offers.spots', { count: o.spotsLeft })}</span>}
                </div>
              </div>
              <Icon name="chevron" className="text-ink2" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
