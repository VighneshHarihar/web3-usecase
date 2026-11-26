import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { describeCondition, describeReward, validateTerms, type OfferTerms } from '@loyallink/shared/core';
import { api, ApiError, errMsg } from '../lib/api';
import { formatINR, lang, rupeesToPaise } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, Card, Field, Input, MoneyInput, PageTitle, Segmented, useToast } from '../components/ui';
import type { MerchantV } from '../lib/types';

const PRESETS = [
  { key: 'visits', v: { minPurchases: '3', minTotalSpend: '1500', minPurchaseAmount: '200', windowDays: '30', rewardKind: 'percent', percent: '20', rewardValue: '300' } },
  { key: 'spend', v: { minPurchases: '1', minTotalSpend: '2000', minPurchaseAmount: '0', windowDays: '60', rewardKind: 'credit', percent: '0', rewardValue: '200' } },
  { key: 'habit', v: { minPurchases: '5', minTotalSpend: '0', minPurchaseAmount: '100', windowDays: '30', rewardKind: 'credit', percent: '0', rewardValue: '150' } },
] as const;

/** M3: offer builder. The plain-language sentence is the source of truth the merchant reads. */
export default function OfferBuilder() {
  const { t } = useTranslation();
  const l = lang();
  const m = useOutletContext<MerchantV>();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [f, setF] = useState<Record<string, string>>({ ...PRESETS[0].v, validity: '60', maxEnrolments: '50', perCustomerLimit: '1' });
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const terms: OfferTerms = useMemo(() => ({
    minPurchases: Number(f.minPurchases) || 0,
    minTotalSpend: rupeesToPaise(f.minTotalSpend || '0') ?? -1,
    minPurchaseAmount: rupeesToPaise(f.minPurchaseAmount || '0') ?? -1,
    windowDays: Number(f.windowDays) || 0,
    rewardKind: f.rewardKind as 'credit' | 'percent',
    rewardValue: rupeesToPaise(f.rewardValue || '0') ?? 0,
    percentBps: f.rewardKind === 'percent' ? Math.round(Number(f.percent) * 100) || 0 : 0,
    rewardValidityDays: Number(f.validity) || 0,
    maxEnrolments: Number(f.maxEnrolments) || 0,
    perCustomerLimit: Number(f.perCustomerLimit) || 0,
  }), [f]);
  const errors = validateTerms(terms);
  const autoTitle = `${describeCondition(terms, l).split(' (')[0]}`;
  const fundsFor = Math.floor(m.available / Math.max(1, terms.rewardValue));
  const fullFunding = terms.rewardValue * terms.maxEnrolments;

  async function save(publish: boolean) {
    setBusy(true);
    try {
      const r = await api.post(`/m/${m.id}/offers`, { ...terms, title: title.trim() || autoTitle.slice(0, 80), description });
      if (publish) {
        try {
          await api.post(`/m/${m.id}/offers/${r.offer.id}/publish`);
          toast(t('m.builder.published'));
        } catch (e) {
          toast(errMsg(e), 'error');
          if (!(e instanceof ApiError)) throw e;
        }
      } else toast(t('m.builder.saved'));
      qc.invalidateQueries({ queryKey: ['moffers', m.id] });
      qc.invalidateQueries({ queryKey: ['dash', m.id] });
      nav(`/m/${m.id}/offers/${r.offer.id}`);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const steps = [t('m.builder.s1'), t('m.builder.s2'), t('m.builder.s3'), t('m.builder.s4')];
  const err = (k: string) => (errors.includes(k as never) ? t(`m.builder.err.${k}`) : undefined);
  const stepOk = [
    !['minPurchases', 'minTotalSpend', 'minPurchaseAmount', 'windowDays'].some((k) => errors.includes(k as never)),
    !['rewardValue', 'percentBps', 'rewardValidityDays'].some((k) => errors.includes(k as never)),
    !['maxEnrolments', 'perCustomerLimit'].some((k) => errors.includes(k as never)),
    errors.length === 0,
  ];

  return (
    <div className="pb-10">
      <PageTitle title={t('m.builder.title')} back={step ? () => setStep(step - 1) : `/m/${m.id}/offers`} />
      <div className="px-5 grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        <div>
          <ol className="flex gap-2 mb-5">
            {steps.map((s, i) => (
              <li key={s} className="flex-1"><div className={`h-1.5 rounded-full ${i <= step ? 'bg-ink' : 'bg-alt'}`} /><div className={`text-xs mt-1.5 font-semibold ${i === step ? '' : 'text-ink2'}`}>{s}</div></li>
            ))}
          </ol>
          {step === 0 && (
            <Card className="p-5 space-y-4">
              <div>
                <div className="text-sm font-semibold mb-2">{t('m.builder.start')}</div>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => <Button key={p.key} variant="soft" size="sm" onClick={() => setF((x) => ({ ...x, ...p.v }))}>{t(`m.builder.preset.${p.key}`)}</Button>)}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={t('m.builder.minPurchases')} error={err('minPurchases')}><Input inputMode="numeric" value={f.minPurchases} onChange={(e) => set('minPurchases')(e.target.value.replace(/\D/g, ''))} /></Field>
                <Field label={t('m.builder.windowDays')} error={err('windowDays')}><Input inputMode="numeric" value={f.windowDays} onChange={(e) => set('windowDays')(e.target.value.replace(/\D/g, ''))} /></Field>
                <Field label={t('m.builder.minTotalSpend')} hint={t('m.builder.zeroHint')}><MoneyInput value={f.minTotalSpend} onChange={set('minTotalSpend')} /></Field>
                <Field label={t('m.builder.minPurchaseAmount')} hint={t('m.builder.minEachHint')}><MoneyInput value={f.minPurchaseAmount} onChange={set('minPurchaseAmount')} /></Field>
              </div>
            </Card>
          )}
          {step === 1 && (
            <Card className="p-5 space-y-4">
              <Segmented value={f.rewardKind} onChange={set('rewardKind')} options={[{ value: 'percent', label: t('m.builder.kindPercent') }, { value: 'credit', label: t('m.builder.kindCredit') }]} />
              <div className="grid sm:grid-cols-2 gap-4">
                {f.rewardKind === 'percent' && (
                  <Field label={t('m.builder.percent')} error={err('percentBps')}><Input inputMode="decimal" value={f.percent} onChange={(e) => set('percent')(e.target.value.replace(/[^\d.]/g, ''))} /></Field>
                )}
                <Field label={f.rewardKind === 'percent' ? t('m.builder.cap') : t('m.builder.credit')} hint={t('m.builder.escrowHint')} error={err('rewardValue')}><MoneyInput value={f.rewardValue} onChange={set('rewardValue')} /></Field>
                <Field label={t('m.builder.validity')} hint={t('m.builder.validityHint')} error={err('rewardValidityDays')}><Input inputMode="numeric" value={f.validity} onChange={(e) => set('validity')(e.target.value.replace(/\D/g, ''))} /></Field>
              </div>
            </Card>
          )}
          {step === 2 && (
            <Card className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label={t('m.builder.maxEnrolments')} hint={t('m.builder.maxHint')} error={err('maxEnrolments')}><Input inputMode="numeric" value={f.maxEnrolments} onChange={(e) => set('maxEnrolments')(e.target.value.replace(/\D/g, ''))} /></Field>
                <Field label={t('m.builder.perCustomer')} hint={t('m.builder.perCustomerHint')} error={err('perCustomerLimit')}><Input inputMode="numeric" value={f.perCustomerLimit} onChange={(e) => set('perCustomerLimit')(e.target.value.replace(/\D/g, ''))} /></Field>
              </div>
              <Field label={t('m.builder.titleLabel')} hint={t('m.builder.titleHint')}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle} maxLength={80} /></Field>
              <Field label={t('m.builder.note')}><Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder={t('m.builder.notePh')} /></Field>
            </Card>
          )}
          {step === 3 && (
            <Card className="p-5 space-y-4">
              <div className="font-bold text-lg">{t('m.builder.review')}</div>
              <div className="p-4 rounded-xl bg-alt leading-relaxed">{describeCondition(terms, l)} → <b>{describeReward(terms, l)}</b></div>
              <ul className="text-sm space-y-2 text-ink2">
                <li className="flex gap-2"><Icon name="shield" size={18} className="text-ok" />{t('m.builder.r1', { amount: formatINR(terms.rewardValue) })}</li>
                <li className="flex gap-2"><Icon name="lock" size={18} className="text-ink" />{t('m.builder.r2')}</li>
                <li className="flex gap-2"><Icon name="tag" size={18} />{t('m.builder.r3')}</li>
                <li className="flex gap-2"><Icon name="info" size={18} />{t('m.builder.r4')}</li>
              </ul>
              {fundsFor < 1 && <div className="p-3 rounded-xl bg-warn-soft text-warn text-sm font-semibold">{t('m.builder.needFunds', { amount: formatINR(terms.rewardValue) })}</div>}
            </Card>
          )}
          <div className="flex gap-3 mt-5">
            {step < 3 ? (
              <Button size="lg" full disabled={!stepOk[step]} onClick={() => setStep(step + 1)}>{t('common.continue')}</Button>
            ) : (
              <>
                <Button size="lg" variant="secondary" loading={busy} onClick={() => save(false)}>{t('m.builder.saveDraft')}</Button>
                <Button size="lg" full loading={busy} disabled={!stepOk[3] || m.status !== 'approved'} onClick={() => save(true)} icon="check">{t('m.builder.publish')}</Button>
              </>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 space-y-3">
          <Card tone="ink" className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold">{t('m.builder.preview')}</div>
            <div className="text-lg font-bold leading-snug mt-2">{describeCondition(terms, l)}</div>
            <div className="text-[#9ED5B0] font-semibold mt-2">→ {describeReward(terms, l)}</div>
          </Card>
          <Card className="p-5 text-sm space-y-2">
            <div className="font-bold">{t('m.builder.funding')}</div>
            <div className="flex justify-between"><span className="text-ink2">{t('m.builder.perCustomerCost')}</span><b>{formatINR(terms.rewardValue)}</b></div>
            <div className="flex justify-between"><span className="text-ink2">{t('m.builder.forAll', { count: terms.maxEnrolments })}</span><b>{formatINR(fullFunding)}</b></div>
            <div className="flex justify-between"><span className="text-ink2">{t('m.pool.available')}</span><b>{formatINR(m.available)}</b></div>
            <div className="p-3 rounded-xl bg-alt text-ink2 leading-relaxed">{t('m.builder.fundNote', { count: Math.min(fundsFor, terms.maxEnrolments) })}</div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
