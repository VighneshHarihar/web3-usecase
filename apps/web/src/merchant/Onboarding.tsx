import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '@loyallink/shared/core';
import { api, errMsg } from '../lib/api';
import { Icon } from '../components/Icon';
import { Button, Card, Field, Input, inputCls, PageTitle } from '../components/ui';

export default function Onboarding() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', category: 'grocery', description: '', address: '', city: '', lat: null as number | null, lng: null as number | null, gstin: '', pan: '', upiId: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => setF((x) => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude })));
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post('/merchants', { ...f, gstin: f.gstin || undefined, pan: f.pan || undefined });
      await qc.invalidateQueries({ queryKey: ['me'] });
      nav(`/m/${r.merchant.id}`, { replace: true });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const steps = [t('m.onb.s1'), t('m.onb.s2'), t('m.onb.s3')];
  const canNext = step === 0 ? f.name.trim().length >= 2 && f.address.trim().length >= 5 && f.city.trim().length >= 2 : step === 1 ? /@/.test(f.upiId) : true;

  return (
    <div className="mx-auto max-w-lg pb-16">
      <PageTitle title={t('m.onb.title')} sub={t('m.onb.sub')} back={step ? () => setStep(step - 1) : '/profile'} />
      <div className="px-5">
        <ol className="flex gap-2 mb-6" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? 'bg-ink' : 'bg-alt'}`} />
              <div className={`text-xs mt-1.5 font-semibold ${i === step ? '' : 'text-ink2'}`}>{s}</div>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-4">
            <Field label={t('m.onb.name')}><Input value={f.name} onChange={set('name')} placeholder="Sharma General Store" autoFocus /></Field>
            <Field label={t('m.onb.category')}>
              <select value={f.category} onChange={set('category')} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
              </select>
            </Field>
            <Field label={t('m.onb.address')}><Input value={f.address} onChange={set('address')} placeholder="14 FC Road, Shivajinagar" /></Field>
            <Field label={t('m.onb.city')}><Input value={f.city} onChange={set('city')} placeholder="Pune" /></Field>
            <Field label={t('m.onb.location')} hint={t('m.onb.locationHint')}>
              <Button type="button" variant="secondary" onClick={locate} icon="pin">{f.lat ? t('m.onb.locationSet') : t('m.onb.useLocation')}</Button>
            </Field>
            <Field label={t('m.onb.about')}><Input value={f.description} onChange={set('description')} maxLength={280} placeholder={t('m.onb.aboutPh')} /></Field>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <Field label={t('m.onb.upi')} hint={t('m.onb.upiHint')}><Input value={f.upiId} onChange={set('upiId')} placeholder="sharmastore@okaxis" autoFocus /></Field>
            <Field label={t('m.onb.gstin')} hint={t('m.onb.gstinHint')}><Input value={f.gstin} onChange={set('gstin')} placeholder="27ABCDE1234F1Z5" className="uppercase" /></Field>
            <Field label={t('m.onb.pan')}><Input value={f.pan} onChange={set('pan')} placeholder="ABCDE1234F" className="uppercase" /></Field>
            <p className="text-xs text-ink2 flex gap-2"><Icon name="shield" size={16} className="text-ok" />{t('m.onb.kycNote')}</p>
          </div>
        )}
        {step === 2 && (
          <Card className="p-5 space-y-3 text-sm">
            <div className="font-bold text-lg">{f.name}</div>
            <div className="text-ink2">{t(`category.${f.category}`)} · {f.address}, {f.city}</div>
            <div>{t('m.onb.upi')}: <b>{f.upiId}</b></div>
            {f.gstin && <div>GSTIN: <b>{f.gstin.toUpperCase()}</b></div>}
            <div className="p-3 rounded-xl bg-alt text-ink2 leading-relaxed">{t('m.onb.next')}</div>
          </Card>
        )}
        {err && <div className="mt-4 p-3 rounded-xl bg-danger-soft text-danger text-sm" role="alert">{err}</div>}
        <div className="mt-6">
          {step < 2 ? <Button size="lg" full disabled={!canNext} onClick={() => setStep(step + 1)}>{t('common.continue')}</Button> : <Button size="lg" full loading={busy} onClick={submit}>{t('m.onb.submit')}</Button>}
        </div>
      </div>
    </div>
  );
}
