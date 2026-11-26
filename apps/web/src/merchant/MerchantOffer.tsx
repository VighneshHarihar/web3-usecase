import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errMsg } from '../lib/api';
import { daysLeft, fmtDate, formatINR, lang } from '../lib/format';
import { Bar, Button, Card, Confirm, Field, Input, LinkButton, Loading, PageTitle, Pill, Stat, useToast } from '../components/ui';
import type { EnrolmentV, MerchantV, OfferCard } from '../lib/types';
import { statusTone } from './Offers';

export default function MerchantOffer() {
  const { oid } = useParams();
  const { t } = useTranslation();
  const l = lang();
  const m = useOutletContext<MerchantV>();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState<null | 'end' | 'pause'>(null);
  const [edit, setEdit] = useState<{ title: string; description: string } | null>(null);
  const q = useQuery<{ offer: OfferCard; stats: Record<string, number> }>({ queryKey: ['moffer', oid], queryFn: () => api.get(`/m/${m.id}/offers/${oid}`) });
  const es = useQuery<{ enrolments: (EnrolmentV & { customer: { ref: string; name: string | null } })[] }>({ queryKey: ['moffer-e', oid], queryFn: () => api.get(`/m/${m.id}/offers/${oid}/enrolments`) });
  const act = useMutation({
    mutationFn: (a: 'publish' | 'pause' | 'resume' | 'end') => api.post(`/m/${m.id}/offers/${oid}/${a}`),
    onSuccess: () => {
      setConfirm(null);
      qc.invalidateQueries({ queryKey: ['moffer', oid] });
      qc.invalidateQueries({ queryKey: ['moffers', m.id] });
      qc.invalidateQueries({ queryKey: ['dash', m.id] });
    },
    onError: (e) => { setConfirm(null); toast(errMsg(e), 'error'); },
  });
  const save = useMutation({
    mutationFn: () => api.patch(`/m/${m.id}/offers/${oid}`, edit),
    onSuccess: () => { setEdit(null); qc.invalidateQueries({ queryKey: ['moffer', oid] }); toast(t('profile.saved')); },
    onError: (e) => toast(errMsg(e), 'error'),
  });
  if (q.isLoading) return <Loading />;
  const { offer: o, stats } = q.data!;
  const s = o.status;

  return (
    <div>
      <PageTitle title={o.title} back={`/m/${m.id}/offers`} right={<Pill tone={statusTone(s)}>{t(`m.offerStatus.${s}`)}</Pill>} />
      <div className="px-5 space-y-5">
        <Card className="p-5">
          <div className="leading-relaxed">{o.text[l].condition} → <b>{o.text[l].reward}</b></div>
          <div className="flex flex-wrap gap-2 mt-4">
            {s === 'draft' && <Button onClick={() => act.mutate('publish')} loading={act.isPending} icon="check">{t('m.builder.publish')}</Button>}
            {s === 'live' && <Button variant="secondary" onClick={() => setConfirm('pause')} icon="pause">{t('m.offer.pause')}</Button>}
            {s === 'paused' && <Button onClick={() => act.mutate('resume')} loading={act.isPending} icon="play">{t('m.offer.resume')}</Button>}
            {s !== 'ended' && <Button variant="ghost" onClick={() => setConfirm('end')} icon="stop">{t('m.offer.end')}</Button>}
            <Button variant="ghost" onClick={() => setEdit({ title: o.title, description: o.description })} icon="edit">{t('m.offer.edit')}</Button>
            {s !== 'draft' && <LinkButton to={`/proof/offer/${o.id}`} variant="ghost" icon="shield">{t('m.offer.proof')}</LinkButton>}
          </div>
          {s !== 'draft' && <p className="text-xs text-ink2 mt-3">{t('m.offer.lockedNote')}</p>}
        </Card>

        {edit && (
          <Card className="p-5 space-y-3">
            <Field label={t('m.builder.titleLabel')}><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={80} /></Field>
            <Field label={t('m.builder.note')}><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} maxLength={500} /></Field>
            <div className="flex gap-2"><Button variant="secondary" onClick={() => setEdit(null)}>{t('common.cancel')}</Button><Button loading={save.isPending} onClick={() => save.mutate()}>{t('common.save')}</Button></div>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label={t('m.offer.inProgress')} value={stats.active ?? 0} />
          <Stat label={t('m.offer.completed')} value={stats.completed ?? 0} tone="ok" />
          <Stat label={t('m.offer.redeemed')} value={stats.redeemed ?? 0} />
          <Stat label={t('m.offer.spots')} value={o.spotsLeft} sub={t('m.offer.of', { count: o.terms.maxEnrolments })} />
        </div>

        <Card className="p-5">
          <div className="font-bold mb-3">{t('m.offer.customers')}</div>
          {es.data?.enrolments.length === 0 && <div className="text-sm text-ink2">{t('m.offer.noCustomers')}</div>}
          <ul className="divide-y divide-line">
            {es.data?.enrolments.map((e) => (
              <li key={e.id} className="py-3 flex items-center gap-3 text-sm">
                <div className="w-40 shrink-0"><b>{e.customer.name ?? t('m.counter.customer')}</b> <span className="text-ink2">#{e.customer.ref}</span></div>
                <div className="flex-1"><Bar value={e.status === 'completed' ? 1 : e.progress.overall} color={e.status === 'completed' ? 'var(--color-ok)' : undefined} /></div>
                <div className="w-28 text-right text-ink2">{e.status === 'active' ? t('progress.daysLeft', { count: daysLeft(e.deadline) }) : t(`progress.status.${e.status}`)}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5 text-sm text-ink2 space-y-1">
          <div>{t('m.offer.published', { date: fmtDate(o.publishedAt) })}</div>
          <div>{t('m.offer.reservePer', { amount: formatINR(o.terms.rewardValue) })}</div>
          <div>{t('m.offer.fee', { pct: (o.feeBps / 100).toFixed(1) })}</div>
        </Card>
      </div>
      <Confirm open={confirm === 'pause'} onClose={() => setConfirm(null)} title={t('m.offer.pauseTitle')} body={t('m.offer.pauseBody')} confirmLabel={t('m.offer.pause')} loading={act.isPending} onConfirm={() => act.mutate('pause')} />
      <Confirm open={confirm === 'end'} onClose={() => setConfirm(null)} title={t('m.offer.endTitle')} body={t('m.offer.endBody')} confirmLabel={t('m.offer.end')} danger loading={act.isPending} onConfirm={() => act.mutate('end')} />
    </div>
  );
}
