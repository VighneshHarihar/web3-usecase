/** All money is integer paise (₹1 = 100 paise). */
export type Paise = number;

const fmtWhole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmtFrac = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,500 or ₹235.20; the decimals are shown only when needed. */
export function formatINR(paise: Paise, opts: { forceDecimals?: boolean } = {}): string {
  if (!Number.isFinite(paise)) return '₹—';
  const neg = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const whole = abs % 100 === 0 && !opts.forceDecimals;
  const s = whole ? fmtWhole.format(abs / 100) : fmtFrac.format(abs / 100);
  return `${neg ? '−' : ''}₹${s}`;
}

/** Parse user input like "1,500", "₹ 99.5" into paise. Returns null if invalid. */
export function parseRupees(input: string | number): Paise | null {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? Math.round(input * 100) : null;
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [w, f = ''] = cleaned.split('.');
  return Number(w) * 100 + Number((f + '00').slice(0, 2));
}

export const rupees = (r: number): Paise => Math.round(r * 100);

/** floor(amount * bps / 10000), integer-safe for paise ranges we use. */
export function bpsOf(amount: Paise, bps: number): Paise {
  return Math.floor((amount * bps) / 10_000);
}

export function formatPercentBps(bps: number): string {
  const p = bps / 100;
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
}
