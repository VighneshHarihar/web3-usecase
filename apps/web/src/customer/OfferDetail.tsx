import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError, errMsg } from '../lib/api';
import { useMe } from '../lib/session';
import { fmtDate, formatINR, lang } from '../lib/format';
import { Icon, ShopGlyph } from '../components/Icon';
import { Button, Card, ErrorBox, LinkButton, Loading, PageTitle, Pill, Sheet, TrustBadge, useToast } from '../components/ui';
import type { EnrolmentV, OfferCard } from '../lib/types';

export function ProofSheet({ open, onClose, offer }: { open: boolean; onClose: () => void; offer: OfferCard }) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('proof.sheetTitle')}>
      <div className="space-y-4 text-sm leading-relaxed">
        <div className="flex gap-3 p-4 rounded-2xl bg-ok-soft text-ok">
          <Icon name="shield" size={24} />
          <div><b>{t('proof.sheetHeld', { amount: formatINR(offer.terms.rewardValue), shop: offer.shop.name })}</b></div>
        </div>
        <ul className="space-y-3 text-ink2">
          <li className="flex gap-2.5"><Icon name="check" size={18} className="text-ok mt-0.5" />{t('proof.rule1')}</li>
          <li className="flex gap-2.5"><Icon name="check" size={18} className="text-ok mt-0.5" />{t('proof.rule2')}</li>
          <li className="flex gap-2.5"><Icon name="check" size={18} className="text-ok mt-0.5" />{t('proof.rule3')}</li>
        </ul>
        <p className="text-xs text-ink2">{t('proof.sheetOptional')}</p>
        <LinkButton to={`/proof/offer/${offer.id}`} variant="secondary" full icon="external">{t('proof.sheetOpen')}</LinkButton>
      </div>
    </Sheet>
  );
}

export default function OfferDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const l = lang();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const [proof, setProof] = useState(false);
  const [joined, setJoined] = useState<EnrolmentV | null>(null);
  const q = useQuery<{ offer: OfferCard; mine: { activeEnrolmentId: string | null; completedTimes: number } | null; waitlisted: boolean; waitlistCount: number }>({
    queryKey: ['offer', id],
    queryFn: () => api.get(`/offers/${id}`),
  });
  const join = useMutation({
    mutationFn: () => api.post<{ enrolment: EnrolmentV }>(`/c/offers/${id}/join`),
    onSuccess: (r) => {
      setJoined(r.enrolment);
      qc.invalidateQueries({ queryKey: ['home'] });
      qc.invalidateQueries({ queryKey: ['offer', id] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'POOL_FULL') qc.invalidateQueries({ queryKey: ['offer', id] });
      toast(errMsg(e), 'error');
    },
  });
  const wait = useMutation({
    mutationFn: () => api.post(`/c/offers/${id}/waitlist`),
    onSuccess: () => {
      toast(t('offer.waitlisted'));
      qc.invalidateQueries({ queryKey: ['offer', id] });
    },
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const { offer: o, mine, waitlisted, waitlistCount } = q.data!;
  const terms = o.terms;
  const closed = o.status !== 'live';
  const full = o.spotsLeft <= 0;
  const limitReached = mine && mine.completedTimes >= terms.perCustomerLimit;

  if (joined) {
    return (
      <div className="min-h-[80dvh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-24 h-24 rounded-full bg-ok-soft text-ok grid place-items-center animate-pop"><Icon name="checkCircle" size={52} stroke={1.6} /></div>
        <h1 className="text-2xl font-bold tracking-tight mt-6">{t('offer.joinedTitle')}</h1>
        <p className="text-ink2 mt-2 leading-relaxed max-w-xs">{t('offer.joinedBody', { amount: formatINR(joined.reserved), date: fmtDate(joined.deadline) })}</p>
        <Card tone="alt" className="p-4 mt-6 text-left">
          <div className="text-sm font-semibold">{t('offer.nextVisit')}</div>
          <div className="text-sm text-ink2 mt-1">{o.text[l].condition}</div>
        </Card>
        <div className="w-full max-w-xs mt-6 space-y-3">
          <LinkButton to="/qr" size="lg" full icon="qr">{t('offer.showQr')}</LinkButton>
          <LinkButton to={`/progress/${joined.id}`} variant="secondary" full>{t('offer.viewProgress')}</LinkButton>
        </div>
      </div>
    );
  }

  let cta;
  if (!me.data) cta = <LinkButton to={`/login?next=/offer/${o.id}`} size="lg" full>{t('offer.signInToJoin')}</LinkButton>;
  else if (mine?.activeEnrolmentId) cta = <LinkButton to={`/progress/${mine.activeEnrolmentId}`} size="lg" full icon="chart">{t('offer.viewProgress')}</LinkButton>;
  else if (closed) cta = <Button size="lg" full disabled>{t('offer.closed')}</Button>;
  else if (limitReached) cta = <Button size="lg" full disabled>{t('offer.limitReached')}</Button>;
  else if (full) cta = waitlisted ? <Button size="lg" full variant="soft" disabled icon="check">{t('offer.onWaitlist')}</Button> : <Button size="lg" full variant="soft" onClick={() => wait.mutate()} loading={wait.isPending}>{t('offer.joinWaitlist')}</Button>;
  else cta = <Button size="lg" full onClick={() => join.mutate()} loading={join.isPending}>{t('offer.join')}</Button>;

  return (
    <div className="pb-32">
      <PageTitle title="" back={() => (window.history.length > 1 ? nav(-1) : nav('/explore'))} />
      <div className="px-5 -mt-6">
        <Link to={`/s/${o.shop.slug}`} className="flex items-center gap-3">
          <ShopGlyph category={o.shop.category} size={56} />
          <div className="min-w-0">
            <div className="font-bold text-lg tracking-tight">{o.shop.name}</div>
            <div className="text-sm text-ink2 truncate">{o.shop.address}, {o.shop.city}</div>
          </div>
        </Link>

        <h1 className="text-[26px] leading-tight font-bold tracking-tight mt-6">{o.title}</h1>
        {o.description && <p className="text-ink2 mt-2 leading-relaxed">{o.description}</p>}

        <div className="mt-5">
          {o.secured ? (
            <TrustBadge prominent onClick={() => setProof(true)} label={t('trust.securedLong', { amount: formatINR(terms.rewardValue) })} />
          ) : (
            <div className="p-3 rounded-xl bg-warn-soft text-warn text-sm font-semibold">{t('offer.fullNote', { count: waitlistCount })}</div>
          )}
        </div>

        <Card className="p-5 mt-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink2">{t('offer.youDo')}</div>
          <ul className="mt-3 space-y-2.5">
            <li className="flex gap-3"><Icon name="receipt" className="text-ink2" /><span>{terms.minPurchases === 1 ? t('offer.doSpend', { amount: formatINR(terms.minTotalSpend) }) : t('offer.doVisits', { count: terms.minPurchases })}</span></li>
            {terms.minTotalSpend > 0 && terms.minPurchases > 1 && <li className="flex gap-3"><Icon name="wallet" className="text-ink2" /><span>{t('offer.doTotal', { amount: formatINR(terms.minTotalSpend) })}</span></li>}
            {terms.minPurchaseAmount > 0 && <li className="flex gap-3"><Icon name="tag" className="text-ink2" /><span>{t('offer.doEach', { amount: formatINR(terms.minPurchaseAmount) })}</span></li>}
            <li className="flex gap-3"><Icon name="clock" className="text-ink2" /><span>{t('offer.doWithin', { count: terms.windowDays })}</span></li>
          </ul>
          <div className="h-px bg-line my-4" />
          <div className="text-xs font-semibold uppercase tracking-wide text-ink2">{t('offer.youGet')}</div>
          <div className="text-xl font-bold tracking-tight mt-2">{o.text[l].reward}</div>
          <div className="text-sm text-ink2 mt-1">{t('offer.validity', { count: terms.rewardValidityDays })}</div>
        </Card>

        <div className="mt-5 space-y-2 text-sm text-ink2">
          <div className="flex justify-between"><span>{t('offer.spotsLabel')}</span><b className="text-ink">{o.spotsLeft}</b></div>
          <div className="flex justify-between"><span>{t('offer.repeatLabel')}</span><b className="text-ink">{t('offer.times', { count: terms.perCustomerLimit })}</b></div>
          <div className="flex justify-between"><span>{t('offer.costLabel')}</span><b className="text-ok">{t('offer.free')}</b></div>
          {mine && mine.completedTimes > 0 && <div className="flex justify-between"><span>{t('offer.earnedBefore')}</span><Pill tone="ok">{t('offer.times', { count: mine.completedTimes })}</Pill></div>}
        </div>
        <p className="text-xs text-ink2 mt-5 leading-relaxed">{t('offer.noRisk')}</p>
      </div>

      <div className="fixed bottom-24 inset-x-0 z-30 px-5 no-print">
        <div className="mx-auto max-w-md">{cta}</div>
      </div>
      <ProofSheet open={proof} onClose={() => setProof(false)} offer={o} />
    </div>
  );
}
