import { useEffect } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { Icon } from '../components/Icon';
import { Card, Empty, Loading, PageTitle } from '../components/ui';

export default function Alerts() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery<{ items: { id: string; kind: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }[] }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/c/notifications'),
  });
  useEffect(() => {
    if (q.data?.items.some((i) => !i.readAt)) api.post('/c/notifications/read').then(() => qc.invalidateQueries({ queryKey: ['home'] }));
  }, [q.data, qc]);
  return (
    <div>
      <PageTitle title={t('alerts.title')} back="/" />
      <div className="px-5">
        {q.isLoading && <Loading />}
        {q.data?.items.length === 0 && <Empty icon="bell" title={t('alerts.none')} body={t('alerts.noneBody')} />}
        <div className="space-y-2.5">
          {q.data?.items.map((n) => {
            const body = (
              <Card className={`p-4 flex gap-3 ${n.readAt ? '' : 'ring-2 ring-accent/40'}`}>
                <div className="w-10 h-10 rounded-xl bg-alt grid place-items-center shrink-0"><Icon name={n.kind === 'reward' ? 'gift' : n.kind === 'waitlist' ? 'sparkles' : n.kind === 'shop' ? 'store' : 'bell'} size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{n.title}</div>
                  <div className="text-sm text-ink2 mt-0.5 leading-snug">{n.body}</div>
                  <div className="text-xs text-ink2 mt-1">{timeAgo(n.createdAt)}</div>
                </div>
              </Card>
            );
            return n.link ? <Link key={n.id} to={n.link} className="block">{body}</Link> : <div key={n.id}>{body}</div>;
          })}
        </div>
      </div>
    </div>
  );
}
