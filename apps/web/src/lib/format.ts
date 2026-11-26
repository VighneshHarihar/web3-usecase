import { formatINR } from '@loyallink/shared/core';
import i18n from '../i18n';

export { formatINR };

const loc = () => (i18n.language === 'hi' ? 'hi-IN' : 'en-IN');

export function fmtDate(d: string | Date | null | undefined, withTime = false) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString(loc(), withTime ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysLeft(d: string | Date) {
  const ms = new Date(d).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function timeAgo(d: string | Date) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' });
  if (s < 60) return rtf.format(-s, 'second');
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

/** "₹1,500" → paise; accepts plain numbers in rupees. */
export function rupeesToPaise(v: string): number | null {
  const c = v.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(c)) return null;
  return Math.round(Number(c) * 100);
}

export const paiseToRupeesInput = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));

export const lang = () => (i18n.language === 'hi' ? 'hi' : 'en') as 'en' | 'hi';
