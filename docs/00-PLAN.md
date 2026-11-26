# 00 · Master plan: LoyalLink v1.0

**Goal:** a working, deployable web app where neighbourhood shops run *pre-funded* loyalty
offers ("3 purchases totalling ₹1,500 in 30 days → 20% off your next bill, up to ₹300") and
regular customers earn rewards that are guaranteed by an on-chain escrow. They never see a
wallet, a token or a fee.

**Inputs:** `Loyalink_PRD.md` (what), *The Invisible Chain* (how to decide, and it wins on
conflicts), and the two LoyalLink prototypes (visual language: warm off-white, near-black ink,
coral accent, green trust tick, Inter).

## Documents
| Doc | Contents |
|---|---|
| [01-PRINCIPLES](01-PRINCIPLES.md) | Seven steps applied; the five rules that must never bend (R1–R5); Da-da-da checklist |
| [02-PRODUCT-SPEC-v1](02-PRODUCT-SPEC-v1.md) | v1 scope, canonical offer rules, worked example, screens, edge cases |
| [03-ARCHITECTURE](03-ARCHITECTURE.md) | Components, write path, trust model, presence code, jobs |
| [04-SMART-CONTRACT](04-SMART-CONTRACT.md) | `LoyaltyEscrow` spec, roles, invariants |
| [05-DATA-MODEL](05-DATA-MODEL.md) | Postgres tables, hash chain |
| [06-API](06-API.md) | Endpoints |
| [07-BUSINESS-MODEL](07-BUSINESS-MODEL.md) | Pricing, unit economics, incentive alignment |
| [08-TECH-STACK](08-TECH-STACK.md) | Open-source stack + ADRs |
| [09-SECURITY-PRIVACY](09-SECURITY-PRIVACY.md) | Threat model, privacy, compliance |
| [10-TESTING](10-TESTING.md) | Test strategy, PRD case coverage, release checklist |
| [11-DEPLOYMENT](11-DEPLOYMENT.md) | Local run, Docker, testnet, production checklist |
| [12-ROADMAP](12-ROADMAP.md) | v1.1 → v3 |

## Execution plan

| Phase | Work | Done when | Status |
|---|---|---|---|
| P0 | Plan + docs | This folder exists | ✅ |
| P1 | Monorepo scaffold (pnpm), `packages/shared`: money, offer rules engine, zod schemas, plain-language describer, unit tests | `pnpm -r test` green for shared | ✅ done |
| P2 | `packages/contracts`: `LoyaltyEscrow`, `TestRupee`, lifecycle + revert + invariant tests, ABI export, deploy script | Contract tests green | ✅ done |
| P3 | `apps/api`: schema + migrations, auth (OTP/sessions), merchants + KYC, offers, pool + payments (sandbox/Razorpay), customer join/waitlist/presence, counter (purchase/redeem/void), ledger hash chain, chain relayer, sweeper, admin, proof, export/delete | API integration tests green against Postgres + Hardhat node | ✅ done |
| P4 | `apps/web`: design system from prototypes, customer PWA, merchant dashboard + counter + builder + pool + poster, admin console, proof pages, i18n en/hi | Builds, manually walked through in a browser | ✅ done |
| P5 | Playwright E2E of the full story, Dockerfile + compose, seed script, README | E2E green, `docker compose up` documented | ✅ done |
| P6 | Release: Da-da-da checklist, commit, push branch | Pushed | ✅ done |

Order rationale: rules first (shared), because both the contract and the API must agree on
them. Contract second, because it is the hardest thing to change later. Then API, then UI.

## v1.0 release status (2026-11-26)

| Suite | Result |
|---|---|
| `packages/shared` rules, money, i18n vocabulary | 19 passing |
| `packages/contracts` lifecycle, roles, fee cap, randomized invariants (250 steps) | 13 passing |
| `apps/api` vs real Postgres, incl. full ledger replay onto a local EVM (DB = contract balances) | 13 passing |
| `apps/web` no-jargon + Hindi-complete checks | 4 passing |
| `e2e` full story through the UI (Hindi customer) | 1 passing |

**Da, da, da**
- *Damyata:* the contract holds only R1 to R5 state; customers are known on-chain only by an HMAC ref; we collect a phone number and an optional first name, nothing else; no token.
- *Datta:* customers pay ₹0; the relayer pays gas; Free plan works for a single shop; MIT licence, docs in-repo.
- *Dayadhvam:* banned-words test green; Hindi complete for every screen except the internal ops console; every destructive action has a confirmation; refunds have a 24 h void window; "lost phone" means signing in again.

**Deviations from the PRD (with reasons):** a singleton immutable escrow instead of EIP-1167 clones (ADR-01), Hardhat instead of Foundry (ADR-02), a rupee-pegged settlement unit instead of USDC for v1 (ADR-03), no Redis (ADR-04), a Vite SPA instead of Next.js (ADR-05), account-based identity instead of Privy embedded wallets (ADR-06), cross-merchant redemption moved to v1.2.

**Known gaps / next:** Docker image not built in this environment (no daemon; the bundle was run with Node directly); Razorpay live flow untested without keys; payouts are a manual ops queue; web-push and the map view are in v1.1.
