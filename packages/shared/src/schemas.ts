import { z } from 'zod';
import { MAX_REWARD_VALIDITY_DAYS, MAX_WINDOW_DAYS, MIN_REWARD_VALIDITY_DAYS } from './rules.js';
import { CATEGORIES, normalizePhone } from './phone.js';

export const phoneSchema = z
  .string()
  .min(8)
  .max(20)
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid mobile number' });
      return z.NEVER;
    }
    return n;
  });

export const otpRequestSchema = z.object({ phone: phoneSchema });
export const otpVerifySchema = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) });

export const meUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  locale: z.enum(['en', 'hi']).optional(),
});

const paise = z.number().int().min(0).max(1_000_000_000_00);


const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
const UPI = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,64}$/;

export const merchantCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum(CATEGORIES),
  description: z.string().trim().max(280).optional().default(''),
  address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(60),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  phone: phoneSchema.optional(),
  gstin: z.string().trim().toUpperCase().regex(GSTIN, 'Invalid GSTIN').optional().or(z.literal('')),
  pan: z.string().trim().toUpperCase().regex(PAN, 'Invalid PAN').optional().or(z.literal('')),
  upiId: z.string().trim().regex(UPI, 'Invalid UPI ID'),
});
export const merchantUpdateSchema = merchantCreateSchema.partial();

export const offerTermsSchema = z.object({
  minPurchases: z.number().int().min(1).max(1000),
  minTotalSpend: paise,
  minPurchaseAmount: paise,
  windowDays: z.number().int().min(1).max(MAX_WINDOW_DAYS),
  rewardKind: z.enum(['credit', 'percent']),
  rewardValue: z.number().int().min(100).max(1_000_000_00),
  percentBps: z.number().int().min(0).max(10_000),
  rewardValidityDays: z.number().int().min(MIN_REWARD_VALIDITY_DAYS).max(MAX_REWARD_VALIDITY_DAYS),
  maxEnrolments: z.number().int().min(1).max(1_000_000),
  perCustomerLimit: z.number().int().min(1).max(100),
});

export const offerCreateSchema = offerTermsSchema.extend({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(500).optional().default(''),
});
export const offerUpdateSchema = offerCreateSchema.partial();

export const amountSchema = z.object({ amount: z.number().int().min(100).max(1_000_000_00) });
export const counterLookupSchema = z.object({ code: z.string().trim().min(6).max(200) });
export const counterPurchaseSchema = z.object({ sessionId: z.string().uuid(), amount: z.number().int().min(1).max(10_000_000_00) });
export const counterRedeemSchema = z.object({
  sessionId: z.string().uuid(),
  rewardId: z.string().uuid(),
  billAmount: z.number().int().min(1).max(10_000_000_00),
});
export const memberAddSchema = z.object({ phone: phoneSchema, role: z.enum(['staff', 'owner']).default('staff') });

export type MerchantCreate = z.infer<typeof merchantCreateSchema>;
export type OfferCreate = z.infer<typeof offerCreateSchema>;
