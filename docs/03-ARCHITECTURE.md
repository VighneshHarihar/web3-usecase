# 03 · Architecture

## 1. System overview

```
             ┌──────────────────────────── Browser (PWA) ────────────────────────────┐
             │  Customer app  ·  Merchant dashboard + Counter  ·  Admin  ·  /proof   │
             │  React + Vite + Tailwind · TanStack Query · i18next (en, hi)          │
             └───────────────▲───────────────────────────────────────────────────────┘
                             │ same-origin JSON over HTTPS, httpOnly session cookie
┌────────────────────────────┴──────────────────────────────────────────────────────┐
│ apps/api — Fastify (Node 22, TypeScript)                                          │
│                                                                                   │
│  routes/  auth · public · customer · merchant · counter · payments · admin · proof│
│  services/ escrow (rules + balances, one DB transaction per operation)            │
│            ledger (append hash-chained event = outbox)                            │
│            payments (Razorpay | sandbox) · sms (console | webhook) · notify       │
│  workers/  chain-relayer · sweeper (expiry, reminders, plans)                     │
│            leader-elected with a Postgres advisory lock                           │
│  static    serves apps/web/dist with SPA fallback                                 │
└──────┬─────────────────────────────────────────────────┬──────────────────────────┘
       │ Drizzle ORM (pg)                                │ viem (operator key)
┌──────▼───────────────┐                       ┌─────────▼──────────────────────────┐
│ PostgreSQL 16        │                       │ EVM chain                          │
│ operational truth +  │                       │ LoyaltyEscrow (immutable)          │
│ ledger_events outbox │                       │ settlement token (tINR in dev)     │
└──────────────────────┘                       │ local: Hardhat node · prod: Base   │
                                               └────────────────────────────────────┘
```

**One deployable unit** (API + static web) and **one database**. The chain is optional at
runtime (`CHAIN_MODE=off|local|rpc`). With it off, the app still runs with the hash-chained
ledger as its witness. In production it must be on.

## 2. The write path (every money-affecting action)

```
request ──► validate (zod) ──► BEGIN
                              ├─ SELECT merchant FOR UPDATE      (balance row lock)
                              ├─ check rules (packages/shared/rules.ts)
                              ├─ update rows (offers, enrolments, rewards, balances…)
                              ├─ pool_movements insert
                              ├─ ledger.append(type, payload)    (advisory lock → prevHash → hash)
                              └─ COMMIT ──► respond (optimistic UI: user sees success now)

chain-relayer (every 2 s, leader only)
   SELECT next pending ledger_events ORDER BY seq LIMIT n
   → map event → contract call (with occurredAt = event time)
   → simulate → send → wait receipt → mark confirmed(tx, block)
      ├─ network/RPC error  → attempts++, exponential backoff
      ├─ AlreadyExists revert → mark confirmed (idempotent replay)
      └─ other revert       → mark failed (divergence alert in admin)
```

Why DB-first instead of chain-first:
- The UX must be instant (PRD 9.4, "optimistic UI") and must survive RPC outages (PRD edge #8).
- The contract re-checks **every** rule, so a bug or a compromised API can't push the chain
  into breaking R1–R5. At worst the relayer stalls and raises an alert.
- Every contract call carries `occurredAt` (bounded to `[now − maxBackdate, now]`), so
  relayer lag doesn't change outcomes (deadlines and void windows are judged at the
  real event time).

## 3. Trust model (v1, stated honestly)

| Actor | Can | Cannot (enforced on-chain) |
|---|---|---|
| Customer | Join, cancel, show presence QR, redeem | n/a |
| Merchant (via API) | Fund, publish/pause/end, record/void purchases, withdraw *available* | Touch committed or owed money; revoke a reward after 24 h; change terms of a live offer; refuse a completion |
| Platform operator (relayer key) | Submit the above on users' behalf, pay gas | Withdraw to anywhere but the operator treasury; exceed the 3% fee cap; move committed/owed money except by the rules |
| Guardian | Pause *new* offers/joins/deposits | Move any funds, block redemption, expiry or withdrawal |
| Admin (multisig in prod) | Grant/revoke roles, set the fee ≤ cap for *future* offers, collect fees | Change past offers' fees, touch balances |

**v1 limitation:** merchants and customers act through the platform's operator key, so the
platform could fabricate *merchant-side* actions (e.g. fake withdrawals to the treasury or
fake purchases spending the merchant's own pool). Customer-side guarantees (R1–R5) still hold,
because no function exists to break them. The roadmap item "self-custodied merchant signer"
(EIP-712 attestations from a passkey smart account) removes the merchant-side trust too.

## 4. Identity and the presence code

- `users.customer_ref = keccak256(HMAC_SHA256(CUSTOMER_REF_SECRET, userId))`. It's stable, and
  without the secret it can't be linked to a phone. This is the only customer identifier on chain.
- **Presence code:** `/api/c/presence` issues a 6-digit code (unique among live codes, TTL
  120 s) and a QR payload `LL1.<code>.<hmac>`. The counter exchanges it for a 5-minute
  **counter session** bound to (merchant, customer, staff). Purchases and redemptions need a
  live counter session, which is the "two-party presence" rule from Step 6.

## 5. Background jobs (sweeper, every 30 s, leader only)
- Expire enrolments past `deadline + 60 s` → reservation back to pool, plus a waitlist notification.
- Expire rewards past `expires_at` → remaining back to pool.
- Reminders: enrolment ends within 24 h; reward expires within 7 days / 1 day (idempotent via
  `notifications.dedupe_key`).
- Plans: Pro past `plan_renews_at` → Free (live offers stay live, nothing destructive).
- Delete expired OTPs, sessions and presence codes.

## 6. Repository layout

```
packages/shared     rules.ts (offer engine), money.ts, schemas.ts (zod), describe.ts (plain-language offer text)
packages/contracts  contracts/LoyaltyEscrow.sol, TestRupee.sol, test/*.ts, scripts/export-abi
apps/api            src/{db,routes,services,workers,lib}, drizzle migrations, vitest tests
apps/web            src/{app,customer,merchant,admin,proof,components,i18n,lib}
e2e                 Playwright end-to-end
docs                this folder
```

## 7. Configuration (env)
See `.env.example`. The key switches: `CHAIN_MODE`, `RPC_URL`, `OPERATOR_PRIVATE_KEY`,
`ESCROW_ADDRESS`, `TOKEN_ADDRESS`, `PAYMENTS_PROVIDER=sandbox|razorpay`,
`SMS_PROVIDER=console|webhook`, `OTP_DEV_ECHO`, `ADMIN_PHONES`, `SESSION_SECRET`,
`CUSTOMER_REF_SECRET`.
