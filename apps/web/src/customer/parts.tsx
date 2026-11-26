import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatPercentBps } from '@loyallink/shared/core';
import { Icon, ShopGlyph } from '../components/Icon';
import { Bar, Card, Pill, Segments, TrustBadge } from '../components/ui';
import { daysLeft, fmtDate, formatINR, lang } from '../lib/format';
import type { EnrolmentV, OfferCard, RewardV } from '../lib/types';

export function rewardShort(o: OfferCard) {
  return o.terms.rewardKind === 'percent' ? `${formatPercentBps(o.terms.percentBps)}` : formatINR(o.terms.rewardValue);
}

export function OfferTile({ o }: { o: OfferCard }) {
  const { t } = useTranslation();
  const l = lang();
  return (
    <Link to={`/offer/${o.id}`} className="w-[260px] shrink-0 bg-surface rounded-[18px] p-4 shadow-[var(--shadow-card)] flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <ShopGlyph category={o.shop.category} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm truncate">{o.shop.name}</div>
          <div className="text-xs text-ink2 truncate">{o.distanceKm != null ? t('offer.kmAway', { km: o.distanceKm }) : o.shop.city}</div>
        </div>
        <Pill tone="accent">{rewardShort(o)}</Pill>
      </div>
      <div className="font-semibold leading-snug text-[15px] min-h-[60px]">{o.text[l].condition} → {o.text[l].reward}</div>
      <div className="flex items-center justify-between">
        {o.secured ? <TrustBadge /> : <Pill tone="warn">{t('offer.waitlist')}</Pill>}
        <span className="text-xs text-ink2">{t('offer.spots', { count: o.spotsLeft })}</span>
      </div>
    </Link>
  );
}

export function OfferRow({ o }: { o: OfferCard }) {
  const { t } = useTranslation();
  const l = lang();
  return (
    <Link to={`/offer/${o.id}`} className="flex gap-3.5 items-center p-3.5 bg-surface rounded-[18px] shadow-[var(--shadow-card)]">
      <ShopGlyph category={o.shop.category} size={48} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm truncate">{o.shop.name}</span>
          {o.distanceKm != null && <span className="text-xs text-ink2 shrink-0">· {o.distanceKm} km</span>}
        </div>
        <div className="text-sm text-ink2 leading-snug mt-0.5">{o.text[l].condition} → <b className="text-ink">{o.text[l].reward}</b></div>
        <div className="mt-1.5">{o.secured ? <TrustBadge /> : <Pill tone="warn">{t('offer.waitlist')}</Pill>}</div>
      </div>
      <Icon name="chevron" size={18} className="text-ink2" />
    </Link>
  );
}

export function nextStep(e: EnrolmentV, t: (k: string, o?: any) => string) {
  const p = e.progress;
  const parts: string[] = [];
  if (p.purchasesLeft > 0) parts.push(t('progress.visitsLeft', { count: p.purchasesLeft }));
  if (p.spendLeft > 0) parts.push(t('progress.spendLeft', { amount: formatINR(p.spendLeft) }));
  return parts.join(t('progress.and'));
}

export function ActiveHero({ e }: { e: EnrolmentV }) {
  const { t } = useTranslation();
  const l = lang();
  const d = daysLeft(e.deadline);
  return (
    <Link to={`/progress/${e.id}`} className="block relative overflow-hidden bg-ink text-white rounded-[28px] p-5 shadow-[var(--shadow-card)]">
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-accent/20 blur-md" />
      <div className="flex items-center gap-2.5 mb-3.5 relative">
        <ShopGlyph category={e.offer.shop.category} size={34} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-white/60 font-semibold">{t('home.inProgress')}</div>
          <div className="font-semibold text-sm truncate">{e.offer.shop.name}</div>
        </div>
        <Pill tone={d <= 2 ? 'warn' : 'accent'}>{t('progress.daysLeft', { count: d })}</Pill>
      </div>
      <div className="text-[21px] font-bold leading-tight tracking-tight pr-6 relative">
        {nextStep(e, t)} {t('progress.toUnlock')} {e.offer.text[l].reward}
      </div>
      <div className="mt-4 space-y-2 relative">
        {e.offer.terms.minPurchases > 1 && <Segments value={e.purchases} total={e.offer.terms.minPurchases} dark />}
        {e.offer.terms.minTotalSpend > 0 && <Bar value={e.progress.spend} dark />}
      </div>
      <div className="flex items-center justify-between mt-3 text-xs relative">
        <span className="text-white/70">{t('progress.summary', { done: e.purchases, total: e.offer.terms.minPurchases, spend: formatINR(e.spend) })}</span>
        <span className="text-[#9ED5B0] font-semibold inline-flex items-center gap-1"><Icon name="check" size={13} stroke={2.6} />{t('trust.reserved', { amount: formatINR(e.reserved) })}</span>
      </div>
    </Link>
  );
}

export function RewardCard({ r, compact }: { r: RewardV; compact?: boolean }) {
  const { t } = useTranslation();
  const l = lang();
  const d = daysLeft(r.expiresAt);
  const active = r.status === 'active';
  return (
    <Card className={`p-4 ${active ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <ShopGlyph category={r.shop.category} size={44} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{r.shop.name}</div>
          <div className="text-lg font-bold tracking-tight leading-snug mt-0.5">{r.text[l]}</div>
          {r.kind === 'credit' && r.remaining !== r.value && active && <div className="text-sm text-ink2">{t('rewards.left', { amount: formatINR(r.remaining) })}</div>}
          {!compact && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {active ? (
                <Pill tone={d <= 7 ? 'danger' : 'ok'} icon="clock">{d <= 7 ? t('rewards.expiresSoon', { count: d }) : t('rewards.validTill', { date: fmtDate(r.expiresAt) })}</Pill>
              ) : (
                <Pill>{t(`rewards.status.${r.status}`)}</Pill>
              )}
              <TrustBadge to={`/proof/reward/${r.id}`} label={t('trust.yours')} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
