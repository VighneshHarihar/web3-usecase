import { sql } from 'drizzle-orm';
import {
  bigint, bigserial, boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

const money = (name: string) => bigint(name, { mode: 'number' }).notNull().default(0);
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const createdAt = () => ts('created_at').notNull().defaultNow();

export const users = pgTable('users', {
  id: id(),
  phone: text('phone').notNull().unique(),
  name: text('name'),
  locale: text('locale').notNull().default('en'),
  isAdmin: boolean('is_admin').notNull().default(false),
  customerRef: text('customer_ref').notNull().unique(),
  createdAt: createdAt(),
  deletedAt: ts('deleted_at'),
});

export const otpCodes = pgTable('otp_codes', {
  id: id(),
  phone: text('phone').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumedAt: ts('consumed_at'),
  createdAt: createdAt(),
}, (t) => [index('otp_phone_idx').on(t.phone, t.createdAt)]);

export const sessions = pgTable('sessions', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: createdAt(),
});

export const merchants = pgTable('merchants', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull().default(''),
  address: text('address').notNull(),
  city: text('city').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  phone: text('phone'),
  gstin: text('gstin'),
  pan: text('pan'),
  upiId: text('upi_id').notNull(),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  rejectionReason: text('rejection_reason'),
  frozen: boolean('frozen').notNull().default(false),
  plan: text('plan').notNull().default('free'),
  planRenewsAt: ts('plan_renews_at'),
  available: money('available'),
  committed: money('committed'),
  owed: money('owed'),
  createdAt: createdAt(),
  approvedAt: ts('approved_at'),
});

export const merchantMembers = pgTable('merchant_members', {
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // owner | staff
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.merchantId, t.userId] })]);

export const offers = pgTable('offers', {
  id: id(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('draft'), // draft | live | paused | ended
  minPurchases: integer('min_purchases').notNull(),
  minTotalSpend: money('min_total_spend'),
  minPurchaseAmount: money('min_purchase_amount'),
  windowDays: integer('window_days').notNull(),
  rewardKind: text('reward_kind').notNull(), // credit | percent
  rewardValue: money('reward_value'),
  percentBps: integer('percent_bps').notNull().default(0),
  rewardValidityDays: integer('reward_validity_days').notNull(),
  maxEnrolments: integer('max_enrolments').notNull(),
  perCustomerLimit: integer('per_customer_limit').notNull().default(1),
  feeBps: integer('fee_bps').notNull().default(0),
  termsHash: text('terms_hash'),
  enrolled: integer('enrolled').notNull().default(0), // active + completed
  createdAt: createdAt(),
  publishedAt: ts('published_at'),
}, (t) => [index('offers_merchant_idx').on(t.merchantId), index('offers_status_idx').on(t.status)]);

export const enrolments = pgTable('enrolments', {
  id: id(),
  offerId: uuid('offer_id').notNull().references(() => offers.id),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: text('status').notNull().default('active'), // active | completed | expired | cancelled
  purchases: integer('purchases').notNull().default(0),
  spend: money('spend'),
  startedAt: ts('started_at').notNull(),
  deadline: ts('deadline').notNull(),
  closedAt: ts('closed_at'),
  rewardId: uuid('reward_id'),
  remindedAt: ts('reminded_at'),
}, (t) => [
  index('enrol_user_idx').on(t.userId, t.status),
  index('enrol_offer_idx').on(t.offerId, t.status),
  uniqueIndex('enrol_one_active').on(t.offerId, t.userId).where(sql`status = 'active'`),
]);

export const visits = pgTable('visits', {
  id: id(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  staffId: uuid('staff_id').notNull().references(() => users.id),
  amount: money('amount'),
  createdAt: createdAt(),
  voidedAt: ts('voided_at'),
}, (t) => [index('visits_merchant_idx').on(t.merchantId, t.createdAt), index('visits_user_idx').on(t.userId)]);

export const purchases = pgTable('purchases', {
  id: id(),
  visitId: uuid('visit_id').notNull().references(() => visits.id),
  enrolmentId: uuid('enrolment_id').notNull().references(() => enrolments.id),
  amount: money('amount'),
  at: ts('at').notNull(),
  voided: boolean('voided').notNull().default(false),
}, (t) => [index('purchases_enrol_idx').on(t.enrolmentId), index('purchases_visit_idx').on(t.visitId)]);

export const rewards = pgTable('rewards', {
  id: id(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  offerId: uuid('offer_id').notNull().references(() => offers.id),
  enrolmentId: uuid('enrolment_id').notNull().references(() => enrolments.id),
  kind: text('kind').notNull(),
  percentBps: integer('percent_bps').notNull().default(0),
  feeBps: integer('fee_bps').notNull(),
  value: money('value'),
  remaining: money('remaining'),
  status: text('status').notNull().default('active'), // active | used | expired | revoked
  issuedAt: ts('issued_at').notNull(),
  expiresAt: ts('expires_at').notNull(),
  remindedDays: integer('reminded_days'),
}, (t) => [index('rewards_user_idx').on(t.userId, t.status), index('rewards_merchant_idx').on(t.merchantId, t.status)]);

export const redemptions = pgTable('redemptions', {
  id: id(),
  rewardId: uuid('reward_id').notNull().references(() => rewards.id),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  staffId: uuid('staff_id').notNull().references(() => users.id),
  billAmount: money('bill_amount'),
  used: money('used'),
  fee: money('fee'),
  returned: money('returned'),
  createdAt: createdAt(),
});

export const poolMovements = pgTable('pool_movements', {
  id: id(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  kind: text('kind').notNull(),
  amount: money('amount'),
  fromBucket: text('from_bucket'),
  toBucket: text('to_bucket'),
  refId: uuid('ref_id'),
  createdAt: createdAt(),
}, (t) => [index('pool_mov_merchant_idx').on(t.merchantId, t.createdAt)]);

export const payments = pgTable('payments', {
  id: id(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  purpose: text('purpose').notNull(), // pool_topup | plan_pro
  amount: money('amount'),
  provider: text('provider').notNull(),
  providerOrderId: text('provider_order_id'),
  providerPaymentId: text('provider_payment_id'),
  status: text('status').notNull().default('created'), // created | paid | failed
  createdAt: createdAt(),
  paidAt: ts('paid_at'),
});

export const payouts = pgTable('payouts', {
  id: id(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  amount: money('amount'),
  upiId: text('upi_id').notNull(),
  status: text('status').notNull().default('requested'), // requested | paid | failed
  reference: text('reference'),
  createdAt: createdAt(),
  paidAt: ts('paid_at'),
});

export const presenceCodes = pgTable('presence_codes', {
  code: text('code').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: ts('expires_at').notNull(),
  createdAt: createdAt(),
});

export const counterSessions = pgTable('counter_sessions', {
  id: id(),
  merchantId: uuid('merchant_id').notNull().references(() => merchants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  staffId: uuid('staff_id').notNull().references(() => users.id),
  presenceCode: text('presence_code'),
  lastResult: jsonb('last_result'),
  expiresAt: ts('expires_at').notNull(),
  createdAt: createdAt(),
});

export const waitlist = pgTable('waitlist', {
  offerId: uuid('offer_id').notNull().references(() => offers.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  createdAt: createdAt(),
  notifiedAt: ts('notified_at'),
}, (t) => [primaryKey({ columns: [t.offerId, t.userId] })]);

export const notifications = pgTable('notifications', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  link: text('link'),
  dedupeKey: text('dedupe_key').unique(),
  readAt: ts('read_at'),
  createdAt: createdAt(),
}, (t) => [index('notif_user_idx').on(t.userId, t.createdAt)]);

export const ledgerEvents = pgTable('ledger_events', {
  seq: bigserial('seq', { mode: 'number' }).primaryKey(),
  type: text('type').notNull(),
  subjectId: uuid('subject_id'),
  merchantId: uuid('merchant_id'),
  payload: jsonb('payload').notNull(),
  prevHash: text('prev_hash').notNull(),
  hash: text('hash').notNull().unique(),
  createdAt: ts('created_at').notNull(),
  chainStatus: text('chain_status').notNull().default('pending'), // pending | confirmed | failed | skipped
  txHash: text('tx_hash'),
  blockNumber: bigint('block_number', { mode: 'number' }),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: ts('next_attempt_at'),
  error: text('error'),
}, (t) => [
  index('ledger_chain_idx').on(t.chainStatus, t.seq),
  index('ledger_subject_idx').on(t.subjectId),
  index('ledger_merchant_idx').on(t.merchantId),
]);

export type User = typeof users.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Enrolment = typeof enrolments.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type LedgerEvent = typeof ledgerEvents.$inferSelect;
