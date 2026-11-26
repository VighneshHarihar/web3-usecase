import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { keccak256, toHex } from 'viem';
import { config } from '../config.js';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const hmac = (secret: string, s: string) => createHmac('sha256', secret).update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const randomDigits = (n: number) => String(randomInt(0, 10 ** n)).padStart(n, '0');

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The only customer identifier that ever goes on chain (docs/03 §4). */
export const customerRefFor = (userId: string) => keccak256(toHex(hmac(config.CUSTOMER_REF_SECRET, userId)));
