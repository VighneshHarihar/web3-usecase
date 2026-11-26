import { useOutletContext } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { fmtDate, formatINR } from '../lib/format';
import { Button, Card, Empty, Loading, PageTitle, Pill } from '../components/ui';
import type { MerchantV } from '../lib/types';

export default function Customers() {
  const { t } = useTranslation();
  const m = useOutletContext<MerchantV>();
  const q = useQuery<{ customers: { ref: string; name: string | null; phone: string; visits: number; spend: number; lastVisit: string; activeOffers: number }[] }>({
    queryKey: ['customers', m.id],
    queryFn: () => api.get(`/m/${m.id}/customers`),
  });
  return (
    <div>
      <PageTitle
        title={t('m.customers.title')}
        sub={t('m.customers.sub')}
        right={m.limits.csvExport ? <a href={`/api/m/${m.id}/customers?format=csv`}><Button size="sm" variant="secondary" icon="download">CSV</Button></a> : <Pill tone="accent">{t('m.customers.csvPro')}</Pill>}
      />
      <div className="px-5">
        {q.isLoading && <Loading />}
        {q.data?.customers.length === 0 && <Empty icon="users" title={t('m.customers.none')} body={t('m.customers.noneBody')} />}
        {!!q.data?.customers.length && (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-ink2 text-xs uppercase tracking-wide">
                <tr><th className="p-4">{t('m.counter.customer')}</th><th className="p-4">{t('m.customers.visits')}</th><th className="p-4">{t('m.customers.spend')}</th><th className="p-4 hidden sm:table-cell">{t('m.customers.last')}</th><th className="p-4 hidden sm:table-cell">{t('m.customers.active')}</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {q.data.customers.map((c) => (
                  <tr key={c.ref}>
                    <td className="p-4"><b>{c.name ?? '—'}</b> <span className="text-ink2">#{c.ref}</span><div className="text-xs text-ink2">{c.phone}</div></td>
                    <td className="p-4 tabular-nums">{c.visits}</td>
                    <td className="p-4 tabular-nums">{formatINR(c.spend)}</td>
                    <td className="p-4 hidden sm:table-cell">{fmtDate(c.lastVisit)}</td>
                    <td className="p-4 hidden sm:table-cell">{c.activeOffers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        <p className="text-xs text-ink2 mt-4">{t('m.customers.privacy')}</p>
      </div>
    </div>
  );
}
