# 05 · Data model (PostgreSQL)

Source of truth: `apps/api/src/db/schema.ts` (Drizzle). Money is `bigint` **paise**. Times are
`timestamptz` (UTC). Primary keys are UUIDs. On-chain ids are `0x` + the UUID hex, left-padded
to bytes32.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Everyone | `phone` unique, `name`, `locale`, `is_admin`, `customer_ref`, `deleted_at` |
| `otp_codes` | Login codes | `phone`, `code_hash` (HMAC), `expires_at`, `attempts`, `consumed_at` |
| `sessions` | Cookie sessions | `token_hash` (sha256), `user_id`, `expires_at` |
| `merchants` | Shops + **pool mirror** | `slug`, `name`, `category`, `address`, `city`, `lat`, `lng`, `gstin`, `pan`, `upi_id`, `status` (pending/approved/rejected), `frozen`, `plan`, `plan_renews_at`, `available`, `committed`, `owed` |
| `merchant_members` | Owner / staff | `merchant_id`, `user_id`, `role` |
| `offers` | Terms (immutable after publish, except title/description) | all rule fields from spec §2, `status` (draft/live/paused/ended), `terms_hash`, `enrolled_count` |
| `enrolments` | A customer doing an offer | `status` (active/completed/expired/cancelled), `purchases`, `spend`, `started_at`, `deadline`, `reward_id` |
| `visits` | One counter scan = one bill | `merchant_id`, `user_id`, `staff_id`, `amount`, `voided_at` |
| `purchases` | A visit applied to an enrolment | `visit_id`, `enrolment_id`, `amount`, `counted` |
| `rewards` | Earned coupons/credits | `kind`, `percent_bps`, `value`, `remaining`, `fee_bps`, `status` (active/used/expired/revoked), `expires_at` |
| `redemptions` | Uses of rewards | `bill_amount`, `used`, `fee`, `returned` |
| `pool_movements` | Merchant pool history | `kind`, `amount`, `bucket_from`, `bucket_to`, `ref_id` |
| `payments` | UPI top-ups and plan purchases | `purpose`, `amount`, `provider`, `provider_order_id`, `status` |
| `payouts` | Withdrawals to bank/UPI | `amount`, `status` (requested/paid/failed), `reference` |
| `presence_codes` | Customer counter codes | `code` (6 digits), `user_id`, `expires_at` |
| `counter_sessions` | Bound scan → actions | `merchant_id`, `user_id`, `staff_id`, `expires_at` |
| `waitlist` | Full offers | `offer_id`, `user_id`, `notified_at` |
| `notifications` | In-app inbox | `kind`, `title`, `body`, `link`, `dedupe_key` unique, `read_at` |
| `ledger_events` | **Hash-chained public ledger + chain outbox** | `seq` bigserial, `type`, `subject_id`, `payload` jsonb (no PII), `prev_hash`, `hash`, `chain_status` (pending/confirmed/failed/skipped), `tx_hash`, `block_number`, `attempts`, `next_attempt_at`, `error` |

## Hash chain
`hash = sha256(prev_hash ‖ seq ‖ type ‖ canonicalJSON(payload) ‖ created_at_iso)`, with the
genesis `prev_hash = 0x00…00`. Appends take `pg_advisory_xact_lock(7001)`, so the chain is
strictly linear. Anyone can recompute it from `/api/proof/ledger`.

## Balance mirror invariant (checked by `/api/admin/overview`)
For each merchant:
`committed = Σ offers.reward_value of active enrolments` and
`owed = Σ rewards.remaining of active rewards`.
