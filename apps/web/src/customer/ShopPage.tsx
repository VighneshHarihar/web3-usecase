import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ShopGlyph } from '../components/Icon';
import { Empty, ErrorBox, Loading, PageTitle, Pill } from '../components/ui';
import type { OfferCard, Shop } from '../lib/types';
import { OfferRow } from './parts';

/** Target of the printed shop poster QR: the main customer acquisition channel. */
export default function ShopPage() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const q = useQuery<{ shop: Shop; offers: OfferCard[] }>({ queryKey: ['shop', slug], queryFn: () => api.get(`/shops/${slug}`) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { shop, offers } = q.data!;
  return (
    <div>
      <PageTitle title="" back="/explore" />
      <div className="px-5 -mt-4">
        <div className="flex items-center gap-4">
          <ShopGlyph category={shop.category} size={72} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{shop.name}</h1>
            <div className="text-sm text-ink2">{shop.address}, {shop.city}</div>
            {shop.verified && <Pill tone="ok" icon="check" className="mt-2">{t('shop.verified')}</Pill>}
          </div>
        </div>
        {shop.description && <p className="text-ink2 mt-4 leading-relaxed">{shop.description}</p>}
        <h2 className="text-lg font-bold mt-7 mb-3">{t('shop.offers')}</h2>
        <div className="space-y-3">
          {offers.length === 0 && <Empty title={t('shop.noOffers')} />}
          {offers.map((o) => <OfferRow key={o.id} o={{ ...o, shop }} />)}
        </div>
      </div>
    </div>
  );
}
