import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, errMsg } from '../lib/api';
import { useConfig } from '../lib/session';
import { fmtDate, formatINR } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, Card, Field, Input, LinkButton, PageTitle, Pill, useToast } from '../components/ui';
import type { MerchantV } from '../lib/types';

export default function Settings() {
  const { t } = useTranslation();
  const m = useOutletContext<MerchantV>();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const cfg = useConfig();
  const [f, setF] = useState({ name: m.name, description: m.description, address: m.address, city: m.city, upiId: m.upiId });
  const [phone, setPhone] = useState('');
  const members = useQuery<{ members: { userId: string; name: string | null; phone: string; role: string }[] }>({ queryKey: ['members', m.id], queryFn: () => api.get(`/m/${m.id}/members`) });
  const save = useMutation({
    mutationFn: () => api.patch(`/m/${m.id}`, f),
    onSuccess: () => { toast(t('profile.saved')); qc.invalidateQueries({ queryKey: ['merchant', m.id] }); },
    onError: (e) => toast(errMsg(e), 'error'),
  });
  const upgrade = useMutation({
    mutationFn: () => api.post(`/m/${m.id}/plan/upgrade`),
    onSuccess: (r) => nav(`/pay/${r.payment.id}?back=/m/${m.id}/settings`),
    onError: (e) => toast(errMsg(e), 'error'),
  });
  const addMember = useMutation({
    mutationFn: () => api.post(`/m/${m.id}/members`, { phone, role: 'staff' }),
    onSuccess: () => { setPhone(''); toast(t('m.settings.added')); qc.invalidateQueries({ queryKey: ['members', m.id] }); },
    onError: (e) => toast(errMsg(e), 'error'),
  });
  const removeMember = useMutation({
    mutationFn: (uid: string) => api.del(`/m/${m.id}/members/${uid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', m.id] }),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const pro = m.plan === 'pro';

  return (
    <div>
      <PageTitle title={t('m.settings.title')} />
      <div className="px-5 grid lg:grid-cols-2 gap-5 items-start">
        <Card className="p-5 space-y-4">
          <div className="font-bold">{t('m.settings.profile')}</div>
          <Field label={t('m.onb.name')}><Input value={f.name} onChange={set('name')} /></Field>
          <Field label={t('m.onb.about')}><Input value={f.description} onChange={set('description')} maxLength={280} /></Field>
          <Field label={t('m.onb.address')}><Input value={f.address} onChange={set('address')} /></Field>
          <Field label={t('m.onb.city')}><Input value={f.city} onChange={set('city')} /></Field>
          <Field label={t('m.onb.upi')} hint={t('m.onb.upiHint')}><Input value={f.upiId} onChange={set('upiId')} /></Field>
          <Button onClick={() => save.mutate()} loading={save.isPending}>{t('common.save')}</Button>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between"><div className="font-bold">{t('m.settings.plan')}</div><Pill tone={pro ? 'ok' : 'neutral'}>{pro ? 'Pro' : 'Free'}</Pill></div>
            {pro ? (
              <p className="text-sm text-ink2 mt-2">{t('m.settings.proUntil', { date: fmtDate(m.planRenewsAt) })}</p>
            ) : (
              <ul className="text-sm text-ink2 mt-2 space-y-1">
                <li>• {t('m.settings.free1', { amount: formatINR(m.limits.poolCap ?? 0) })}</li>
                <li>• {t('m.settings.free2')}</li>
              </ul>
            )}
            <div className="mt-3 p-3 rounded-xl bg-alt text-sm">
              <b>Pro · {formatINR(cfg.data?.plans?.pro?.price ?? 99900)} / {t('m.settings.days30')}</b>
              <div className="text-ink2 mt-1">{t('m.settings.proIncludes')}</div>
            </div>
            <Button className="mt-3" onClick={() => upgrade.mutate()} loading={upgrade.isPending} disabled={m.status !== 'approved'} icon="sparkles">{pro ? t('m.settings.extend') : t('m.settings.upgrade')}</Button>
            <p className="text-xs text-ink2 mt-3">{t('m.settings.fee', { pct: ((cfg.data?.feeBps ?? 200) / 100).toFixed(0) })}</p>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="font-bold">{t('m.settings.team')}</div>
            <ul className="divide-y divide-line text-sm">
              {members.data?.members.map((x) => (
                <li key={x.userId} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1"><b>{x.name ?? x.phone}</b> <span className="text-ink2">{x.phone}</span></span>
                  <Pill>{t(`m.role.${x.role}`)}</Pill>
                  {x.role === 'staff' && <button onClick={() => removeMember.mutate(x.userId)} className="text-danger p-2" aria-label={t('m.settings.remove')}><Icon name="trash" size={18} /></button>}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input type="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={t('login.phone')} />
              <Button variant="soft" onClick={() => addMember.mutate()} disabled={!phone} loading={addMember.isPending}>{t('m.settings.add')}</Button>
            </div>
            <p className="text-xs text-ink2">{t('m.settings.teamHint')}</p>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="font-bold">{t('m.settings.share')}</div>
            <p className="text-sm text-ink2">{t('m.settings.shareBody')}</p>
            <div className="flex flex-wrap gap-2">
              <LinkButton to={`/m/${m.id}/poster`} variant="secondary" icon="printer">{t('m.settings.poster')}</LinkButton>
              <LinkButton to={`/s/${m.slug}`} variant="ghost" icon="external">{t('m.settings.publicPage')}</LinkButton>
              {m.status === 'approved' && <LinkButton to={`/proof/merchant/${m.id}`} variant="ghost" icon="shield">{t('m.settings.proof')}</LinkButton>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
