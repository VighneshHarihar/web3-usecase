import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import { lang } from '../lib/format';
import { Button, LinkButton, Loading } from '../components/ui';
import { Icon } from '../components/Icon';
import type { MerchantV, OfferCard } from '../lib/types';

/** Printable counter poster. The shop is the distribution channel (PRD §6.3). */
export default function Poster() {
  const { mid } = useParams();
  const { t } = useTranslation();
  const l = lang();
  const m = useQuery<{ merchant: MerchantV }>({ queryKey: ['merchant', mid], queryFn: () => api.get(`/m/${mid}`) });
  const offers = useQuery<{ offers: OfferCard[] }>({ queryKey: ['moffers', mid], queryFn: () => api.get(`/m/${mid}/offers`) });
  const [img, setImg] = useState('');
  const url = m.data ? `${window.location.origin}/s/${m.data.merchant.slug}` : '';
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#1F1B16', light: '#FFFFFF' } }).then(setImg);
  }, [url]);
  if (!m.data) return <Loading />;
  const live = offers.data?.offers.find((o) => o.status === 'live');
  return (
    <div className="min-h-dvh bg-alt py-6 print:py-0 print:bg-white">
      <div className="no-print max-w-[148mm] mx-auto flex gap-2 mb-4 px-4">
        <LinkButton to={`/m/${mid}/settings`} variant="ghost" icon="back">{t('common.back')}</LinkButton>
        <Button onClick={() => window.print()} icon="printer" className="ml-auto">{t('m.poster.print')}</Button>
      </div>
      <div className="bg-white mx-auto w-full max-w-[148mm] min-h-[200mm] p-10 flex flex-col items-center text-center shadow-[var(--shadow-lg)] print:shadow-none">
        <div className="flex items-center gap-2"><img src="/icon.svg" alt="" width={36} height={36} className="rounded-[10px]" /><span className="font-bold text-xl">LoyalLink</span></div>
        <h1 className="text-[34px] leading-tight font-bold tracking-tight mt-8">{m.data.merchant.name}</h1>
        <p className="text-xl mt-3 font-semibold text-ink2">{t('m.poster.headline')}</p>
        {live && <div className="mt-6 px-5 py-4 rounded-2xl bg-alt text-lg font-semibold leading-snug">{live.text[l].condition}<br />→ {live.text[l].reward}</div>}
        {img && <img src={img} alt="QR" className="w-64 h-64 mt-8" />}
        <p className="text-lg font-bold mt-4">{t('m.poster.scan')}</p>
        <div className="mt-auto pt-8 flex items-center gap-2 text-ok font-semibold"><Icon name="shield" />{t('m.poster.trust')}</div>
        <p className="text-sm text-ink2 mt-2">{t('m.poster.free')}</p>
      </div>
    </div>
  );
}
