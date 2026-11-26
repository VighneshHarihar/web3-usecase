/** Normalise to E.164. Bare 10-digit numbers are treated as Indian (+91). */
export function normalizePhone(input: string): string | null {
  const s = input.replace(/[\s\-().]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(s)) return s;
  const digits = s.replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

export function maskPhone(e164: string): string {
  return `••••${e164.slice(-4)}`;
}


export const CATEGORIES = ['grocery', 'food', 'coffee', 'bakery', 'retail', 'pharmacy', 'salon', 'services', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
