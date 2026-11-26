import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

type BtnVariant = 'primary' | 'accent' | 'secondary' | 'soft' | 'ghost' | 'danger';
const btnBase = 'inline-flex items-center justify-center gap-2 font-semibold tracking-[-0.01em] transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none';
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-ink text-white hover:bg-black',
  accent: 'bg-accent-strong text-white hover:brightness-95',
  secondary: 'border-[1.5px] border-line text-ink bg-surface hover:bg-alt',
  soft: 'bg-alt text-ink hover:brightness-[0.97]',
  ghost: 'text-ink2 hover:bg-alt',
  danger: 'bg-danger text-white hover:brightness-95',
};
const btnSizes = { sm: 'h-10 px-3.5 text-sm rounded-xl', md: 'h-12 px-4.5 text-base rounded-[14px]', lg: 'h-14 px-5 text-[17px] rounded-2xl' };

export function Button({ variant = 'primary', size = 'md', full, icon, loading, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes; full?: boolean; icon?: string; loading?: boolean }) {
  return (
    <button {...rest} disabled={rest.disabled || loading} className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${full ? 'w-full' : ''} ${className}`}>
      {loading ? <Spinner small /> : icon ? <Icon name={icon} size={18} stroke={2} /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'primary', size = 'md', full, icon, children, className = '' }: { to: string; variant?: BtnVariant; size?: keyof typeof btnSizes; full?: boolean; icon?: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${full ? 'w-full' : ''} ${className}`}>
      {icon && <Icon name={icon} size={18} stroke={2} />}
      {children}
    </Link>
  );
}

export function Card({ children, className = '', tone = 'surface', onClick }: { children: ReactNode; className?: string; tone?: 'surface' | 'alt' | 'ink'; onClick?: () => void }) {
  const tones = { surface: 'bg-surface shadow-[var(--shadow-card)]', alt: 'bg-alt', ink: 'bg-ink text-white shadow-[var(--shadow-card)]' };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`block text-left w-full rounded-[var(--radius-card)] ${tones[tone]} ${onClick ? 'cursor-pointer hover:brightness-[0.99] active:scale-[0.995] transition' : ''} ${className}`}>
      {children}
    </Tag>
  );
}

type PillTone = 'neutral' | 'ok' | 'warn' | 'accent' | 'ink' | 'danger';
export function Pill({ children, tone = 'neutral', icon, className = '' }: { children: ReactNode; tone?: PillTone; icon?: string; className?: string }) {
  const tones: Record<PillTone, string> = {
    neutral: 'bg-alt text-ink', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', accent: 'bg-accent-soft text-accent-ink', ink: 'bg-ink text-white', danger: 'bg-danger-soft text-danger',
  };
  return (
    <span className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
      {icon && <Icon name={icon} size={13} stroke={2.2} />}
      {children}
    </span>
  );
}

/** The "✓ Reward secured" tick. Tap opens the proof (Invisible Chain step 6). */
export function TrustBadge({ to, label, prominent, onClick }: { to?: string; label?: string; prominent?: boolean; onClick?: () => void }) {
  const { t } = useTranslation();
  const text = label ?? t('trust.secured');
  if (prominent) {
    const cls = 'w-full flex items-center gap-2 px-3 py-3 rounded-xl bg-ok-soft text-ok text-sm font-semibold text-left';
    const body = (
      <>
        <Icon name="shield" size={18} stroke={2} />
        <span className="flex-1">{text}</span>
        <span className="text-xs font-medium opacity-80 shrink-0">{t('trust.seeProof')} →</span>
      </>
    );
    return onClick ? <button onClick={onClick} className={cls}>{body}</button> : <Link to={to ?? '/how-it-works'} className={cls}>{body}</Link>;
  }
  const inner = (
    <>
      <Icon name="check" size={13} stroke={2.6} />
      <span>{text}</span>
    </>
  );
  return to ? (
    <Link to={to} className="inline-flex items-center gap-1 text-ok text-xs font-semibold">{inner}</Link>
  ) : (
    <span className="inline-flex items-center gap-1 text-ok text-xs font-semibold">{inner}</span>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return <span role="status" aria-label="Loading" className={`inline-block rounded-full border-2 border-current border-r-transparent animate-spin ${small ? 'w-4 h-4' : 'w-6 h-6'}`} />;
}

export function Loading() {
  return (
    <div className="grid place-items-center py-20 text-ink2">
      <Spinner />
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="m-5 p-4 rounded-2xl bg-danger-soft text-danger text-sm flex gap-3 items-start" role="alert">
      <Icon name="alert" size={20} />
      <div className="flex-1">
        <div className="font-semibold">{(error as Error)?.message ?? t('common.error')}</div>
        {onRetry && <button className="underline mt-1" onClick={onRetry}>{t('common.retry')}</button>}
      </div>
    </div>
  );
}

export function Empty({ icon = 'sparkles', title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-alt grid place-items-center text-ink2 mb-4"><Icon name={icon} size={26} /></div>
      <div className="font-bold text-lg tracking-tight">{title}</div>
      {body && <p className="text-ink2 text-sm mt-1.5 max-w-xs mx-auto leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 10, children, color = 'var(--color-accent)' }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-alt)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.32,.72,0,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Segments({ value, total, dark }: { value: number; total: number; dark?: boolean }) {
  const n = Math.min(total, 12);
  const filled = Math.round((value / total) * n);
  return (
    <div className="flex gap-1.5" role="progressbar" aria-valuenow={value} aria-valuemax={total} aria-valuemin={0}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`h-2.5 flex-1 rounded-full ${i < filled ? 'bg-accent' : dark ? 'bg-white/15' : 'bg-alt'}`} />
      ))}
    </div>
  );
}

export function Bar({ value, dark, color }: { value: number; dark?: boolean; color?: string }) {
  return (
    <div className={`h-2.5 rounded-full overflow-hidden ${dark ? 'bg-white/15' : 'bg-alt'}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, value * 100)}%`, background: color ?? 'var(--color-accent)' }} />
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-ink2 mt-1.5 leading-relaxed">{hint}</span>}
      {error && <span className="block text-xs text-danger mt-1.5 font-medium">{error}</span>}
    </label>
  );
}

export const inputCls = 'w-full h-12 px-3.5 rounded-xl bg-surface border-[1.5px] border-line text-base focus:border-ink outline-none transition placeholder:text-ink3';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function MoneyInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink2 font-semibold">₹</span>
      <input {...rest} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} className={`${inputCls} pl-8 font-semibold tabular-nums`} />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`w-12 h-7 rounded-full p-0.5 transition ${checked ? 'bg-ok' : 'bg-ink3/40'}`}>
      <span className={`block w-6 h-6 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex p-1 bg-alt rounded-xl gap-1" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className={`flex-1 h-10 rounded-lg text-sm font-semibold transition ${value === o.value ? 'bg-surface shadow-sm text-ink' : 'text-ink2'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/45" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="relative w-full sm:max-w-md bg-bg rounded-t-[28px] sm:rounded-[28px] shadow-[var(--shadow-lg)] max-h-[92vh] overflow-y-auto animate-rise outline-none">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-1.5 rounded-full bg-ink/15" /></div>
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <div className="font-bold text-lg tracking-tight">{title}</div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 grid place-items-center rounded-full hover:bg-alt"><Icon name="close" size={20} /></button>
        </div>
        <div className="px-5 pb-6 pt-2">{children}</div>
      </div>
    </div>
  );
}

/** Confirm big actions (Invisible Chain step 5: "with awe"). */
export function Confirm({ open, title, body, confirmLabel, danger, loading, onConfirm, onClose }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="text-ink2 leading-relaxed">{body}</div>
      <div className="flex gap-3 mt-6">
        <Button variant="secondary" full onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant={danger ? 'danger' : 'primary'} full onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}

// ── Toasts ──
type Toast = { id: number; text: string; tone: 'ok' | 'error' | 'info' };
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed top-3 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`animate-rise pointer-events-auto max-w-md w-full px-4 py-3 rounded-2xl shadow-[var(--shadow-lg)] text-sm font-semibold flex items-center gap-2 ${i.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-white'}`}>
            <Icon name={i.tone === 'error' ? 'alert' : 'checkCircle'} size={18} />
            {i.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function PageTitle({ title, sub, back, right }: { title: string; sub?: string; back?: string | (() => void); right?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-5 pt-5 pb-4">
      {back && (typeof back === 'string' ? (
        <Link to={back} aria-label="Back" className="w-10 h-10 -ml-2 grid place-items-center rounded-full hover:bg-alt shrink-0"><Icon name="back" /></Link>
      ) : (
        <button onClick={back} aria-label="Back" className="w-10 h-10 -ml-2 grid place-items-center rounded-full hover:bg-alt shrink-0"><Icon name="back" /></button>
      ))}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight leading-tight">{title}</h1>
        {sub && <p className="text-sm text-ink2 mt-1">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'ok' }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink2">{label}</div>
      <div className={`text-2xl font-bold tracking-tight mt-1.5 tabular-nums ${tone === 'accent' ? 'text-accent-strong' : tone === 'ok' ? 'text-ok' : ''}`}>{value}</div>
      {sub && <div className="text-xs text-ink2 mt-1">{sub}</div>}
    </Card>
  );
}
