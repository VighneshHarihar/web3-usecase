import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import { formatINR } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, Card, LinkButton, Spinner } from '../components/ui';

type Presence = { code: string; qr: string; expiresAt: string };
type Result =
  | { kind: 'purchase'; amount: number; outcomes: { offerTitle: string; counted: boolean; reason?: string; completed: boolean; purchases: number; minPurchases: number; rewardText?: string }[] }
  | { kind: 'redeem'; bill: number; discount: number; payable: number };

/** "Show this at the counter". One QR for everything (Invisible Chain step 5: hospitality). */
export default function QrScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [p, setP] = useState<Presence | null>(null);
  const [img, setImg] = useState<string>('');
  const [left, setLeft] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const seen = useRef<string>('');

  async function refresh() {
    const r = await api.post<Presence>('/c/presence');
    setP(r);
    setImg(await QRCode.toDataURL(r.qr, { margin: 1, width: 560, color: { dark: '#1F1B16', light: '#FFFFFF' }, errorCorrectionLevel: 'M' }));
  }

  useEffect(() => {
    refresh();
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as any).wakeLock?.request('screen').then((l: any) => (lock = l)).catch(() => undefined);
    return () => void lock?.release().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!p) return;
    const tick = () => {
      const s = Math.max(0, Math.round((new Date(p.expiresAt).getTime() - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) refresh();
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [p]);

  useQuery({
    queryKey: ['presence', p?.code],
    enabled: !!p,
    refetchInterval: 2000,
    queryFn: async () => {
      const s = await api.get<{ scanned: boolean; result: (Result & { at: string }) | null }>(`/c/presence/${p!.code}/status`).catch(() => null);
      if (s?.result && s.result.at !== seen.current) {
        seen.current = s.result.at;
        setResult(s.result);
        qc.invalidateQueries({ queryKey: ['home'] });
        qc.invalidateQueries({ queryKey: ['rewards'] });
        if (navigator.vibrate) navigator.vibrate(60);
      }
      return s;
    },
  });

  const completed = result?.kind === 'purchase' && result.outcomes.some((o) => o.completed);

  return (
    <div className="min-h-[85dvh] bg-ink text-white rounded-b-[32px] px-5 pt-6 pb-8 flex flex-col">
      <h1 className="text-2xl font-bold tracking-tight text-center">{t('qr.title')}</h1>
      <p className="text-white/70 text-center text-sm mt-1.5">{t('qr.sub')}</p>

      <div className="mx-auto mt-6 bg-white rounded-[28px] p-4 w-full max-w-[300px] aspect-square grid place-items-center">
        {img ? <img src={img} alt={t('qr.alt')} className="w-full h-full" /> : <Spinner />}
      </div>

      <div className="text-center mt-5">
        <div className="text-xs uppercase tracking-widest text-white/60 font-semibold">{t('qr.orCode')}</div>
        <div className="text-[40px] font-bold tracking-[0.25em] tabular-nums mt-1" aria-live="polite">{p ? `${p.code.slice(0, 3)} ${p.code.slice(3)}` : '··· ···'}</div>
        <div className="text-xs text-white/60 mt-1 inline-flex items-center gap-1.5"><Icon name="clock" size={14} />{t('qr.refreshes', { seconds: left })}</div>
      </div>

      {result && (
        <Card className="mt-6 p-5 text-ink animate-rise">
          {result.kind === 'purchase' ? (
            <>
              <div className="flex items-center gap-2 font-bold text-lg">
                <Icon name={completed ? 'sparkles' : 'checkCircle'} className={completed ? 'text-accent-strong' : 'text-ok'} />
                {completed ? t('qr.unlocked') : t('qr.recorded', { amount: formatINR(result.amount) })}
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {result.outcomes.map((o, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-ink2">{o.offerTitle}</span>
                    <b className="shrink-0">{o.completed ? o.rewardText : o.counted ? `${o.purchases}/${o.minPurchases}` : t(`qr.reason.${o.reason}`)}</b>
                  </li>
                ))}
                {result.outcomes.length === 0 && <li className="text-ink2">{t('qr.noOffersHere')}</li>}
              </ul>
              {completed && <LinkButton to="/rewards" full className="mt-4" icon="gift">{t('qr.seeReward')}</LinkButton>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 font-bold text-lg"><Icon name="sparkles" className="text-accent-strong" />{t('qr.saved', { amount: formatINR(result.discount) })}</div>
              <div className="text-sm text-ink2 mt-2">{t('qr.youPay', { bill: formatINR(result.bill), pay: formatINR(result.payable) })}</div>
            </>
          )}
        </Card>
      )}

      <div className="mt-auto pt-6 text-center">
        <p className="text-xs text-white/60 leading-relaxed max-w-xs mx-auto">{t('qr.safe')}</p>
        <Button variant="ghost" className="text-white/80 mt-2" onClick={() => { setResult(null); refresh(); }} icon="undo">{t('qr.newCode')}</Button>
      </div>
    </div>
  );
}
