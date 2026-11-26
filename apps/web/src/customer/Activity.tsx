import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { fmtDate, formatINR } from '../lib/format';
import { Icon } from '../components/Icon';
import { Card, Empty, Loading, PageTitle } from '../components/ui';

const ICON: Record<string, string> = {
  purchase: 'receipt', purchase_voided: 'undo', joined: 'plus', reward: 'gift', redeemed: 'sparkles', enrolment_expired: 'clock', enrolment_cancelled: 'close',
};

export default function Activity({ embedded }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const q = useQuery<{ items: { kind: string; at: string; shop: string; amount: number; title?: string; id: string }[] }>({ queryKey: ['activity'], queryFn: () => api.get('/c/activity') });
  return (
    <div>
      {!embedded && <PageTitle title={t('activity.title')} back="/profile" />}
      <div className="px-5 mt-4">
        {q.isLoading && <Loading />}
        {q.data?.items.length === 0 && <Empty icon="receipt" title={t('activity.none')} />}
        {!!q.data?.items.length && (
          <Card className="divide-y divide-line">
            {q.data.items.map((i) => (
              <div key={`${i.kind}-${i.id}`} className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-alt grid place-items-center text-ink2"><Icon name={ICON[i.kind] ?? 'info'} size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{t(`activity.kind.${i.kind}`)} · {i.shop}</div>
                  <div className="text-xs text-ink2">{fmtDate(i.at, true)}{i.title ? ` · ${i.title}` : ''}</div>
                </div>
                {i.amount > 0 && <b className={`tabular-nums text-sm ${i.kind === 'redeemed' || i.kind === 'reward' ? 'text-ok' : ''}`}>{formatINR(i.amount)}</b>}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
