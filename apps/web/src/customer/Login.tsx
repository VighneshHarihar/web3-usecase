import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { normalizePhone } from '@loyallink/shared/core';
import { api, errMsg } from '../lib/api';
import { Button, Field, Input, PageTitle } from '../components/ui';
import { Icon } from '../components/Icon';
import { LangSwitch, Logo } from './Landing';
import { setLanguage } from '../i18n';

export default function Login() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  const [step, setStep] = useState<'phone' | 'code' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setErr(null);
    if (!normalizePhone(phone)) return setErr(t('login.badPhone'));
    setBusy(true);
    try {
      const r = await api.post('/auth/otp/request', { phone, locale: i18n.language });
      setDevCode(r.devCode ?? null);
      setStep('code');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e?: FormEvent) {
    e?.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api.post('/auth/otp/verify', { phone, code, locale: i18n.language });
      if (r.user.locale && r.user.locale !== i18n.language) setLanguage(r.user.locale);
      await qc.invalidateQueries({ queryKey: ['me'] });
      if (r.isNew || !r.user.name) setStep('name');
      else nav(next, { replace: true });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveName(e?: FormEvent) {
    e?.preventDefault();
    if (name.trim()) await api.patch('/me', { name: name.trim(), locale: i18n.language }).catch(() => undefined);
    await qc.invalidateQueries({ queryKey: ['me'] });
    nav(next, { replace: true });
  }

  return (
    <div className="mx-auto max-w-md min-h-dvh flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5">
        <Logo />
        <LangSwitch />
      </div>
      {step === 'phone' && (
        <form onSubmit={sendCode} className="flex-1 flex flex-col">
          <PageTitle title={t('login.title')} sub={t('login.sub')} />
          <div className="px-5 space-y-4">
            <Field label={t('login.phone')} error={err ?? undefined}>
              <div className="flex gap-2">
                <span className="h-12 px-3 rounded-xl bg-alt grid place-items-center font-semibold text-ink2">+91</span>
                <Input autoFocus type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={t('login.phone')} />
              </div>
            </Field>
            <Button type="submit" size="lg" full loading={busy}>{t('login.send')}</Button>
            <p className="text-xs text-ink2 leading-relaxed flex gap-2"><Icon name="shield" size={16} className="text-ok" />{t('login.privacy')}</p>
          </div>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={verify} className="flex-1 flex flex-col">
          <PageTitle title={t('login.codeTitle')} sub={t('login.codeSub', { phone })} back={() => setStep('phone')} />
          <div className="px-5 space-y-4">
            {devCode && (
              <div className="p-3 rounded-xl bg-warn-soft text-warn text-sm font-medium" role="note">
                {t('login.devCode')} <b className="tabular-nums tracking-widest">{devCode}</b>
              </div>
            )}
            <Field label={t('login.code')} error={err ?? undefined}>
              <Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="text-center text-2xl tracking-[0.5em] font-bold" />
            </Field>
            <Button type="submit" size="lg" full loading={busy} disabled={code.length !== 6}>{t('login.verify')}</Button>
            <Button type="button" variant="ghost" full onClick={() => sendCode()}>{t('login.resend')}</Button>
          </div>
        </form>
      )}
      {step === 'name' && (
        <form onSubmit={saveName} className="flex-1 flex flex-col">
          <PageTitle title={t('login.nameTitle')} sub={t('login.nameSub')} />
          <div className="px-5 space-y-4">
            <Field label={t('login.name')}>
              <Input autoFocus autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </Field>
            <Button type="submit" size="lg" full>{t('common.continue')}</Button>
            <Button type="button" variant="ghost" full onClick={() => nav(next, { replace: true })}>{t('common.skip')}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
