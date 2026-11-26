# 08 · Tech stack and decisions (all open source)

| Layer | Choice | License | Why |
|---|---|---|---|
| Language | TypeScript 5 / Node 22 | Apache-2 / MIT | One language across API, web and tests |
| Monorepo | pnpm workspaces | MIT | Fast, strict |
| Contracts | Solidity 0.8.28 + OpenZeppelin 5 | MIT | Audited primitives (PRD) |
| Contract tooling | Hardhat 2 + solc-js + hardhat-viem, mocha | MIT | See ADR-02 |
| Chain client | viem | MIT | Typed, light |
| Chain (dev / test / prod) | Hardhat node / Base Sepolia / Base | n/a | Low fees (PRD §6.2) |
| API | Fastify 5, @fastify/cookie, helmet, rate-limit, static | MIT | Fast, schema-first |
| Validation | zod (+ shared schemas) | MIT | Same schemas in web and API |
| DB | PostgreSQL 16 | PostgreSQL | PRD |
| ORM / migrations | Drizzle ORM + drizzle-kit | Apache-2 | Pure TS, SQL migrations, no binary engines |
| Jobs | In-process workers + Postgres advisory-lock leader election | n/a | No Redis needed at v1 scale (ADR-04) |
| Web | React 19 + Vite + React Router 7 | MIT | Small bundle for cheap phones (ADR-05) |
| Styling | Tailwind CSS 4 | MIT | Tokens from the prototypes |
| Data fetching | TanStack Query 5 | MIT | Caching, optimistic updates |
| i18n | i18next + react-i18next | MIT | en + hi |
| QR | `qrcode` (generate), `jsqr` (decode camera frames) | MIT / Apache-2 | Works without the BarcodeDetector API |
| PWA | vite-plugin-pwa (Workbox) | MIT | Installable, offline shell |
| Tests | Vitest, Playwright | MIT / Apache-2 | |
| Payments | Razorpay (adapter) + built-in sandbox | proprietary service, adapter is ours | UPI in India; sandbox keeps dev free |
| SMS | Adapter: console (dev) / generic HTTPS webhook (MSG91, Twilio, Gupshup…) | n/a | No vendor lock-in |
| Container | Docker + docker compose | Apache-2 | |

## ADRs

**ADR-01 Singleton escrow instead of per-merchant clones.** See `04-SMART-CONTRACT.md`.

**ADR-02 Hardhat instead of Foundry.** The PRD prefers Foundry. Foundry binaries and native
solc downloads aren't reachable from our build environment, while Hardhat + solc-js install
from the npm registry alone. Contracts are framework-agnostic, so adding `foundry.toml`
later is a one-file change.

**ADR-03 Rupee-pegged settlement unit in v1 (not USDC).** India-first users think in ₹. A
USD stablecoin adds FX conversion on every reservation, makes ₹300 rewards show as ₹299.40,
and adds depeg risk to a value the customer was promised in rupees. It also raises TDS and VDA
questions (PRD §12). The contract is token-agnostic (`IERC20`, any decimals). v1 deploys
`TestRupee` (tINR, 2 decimals) for dev/testnet. Production uses whichever regulated
settlement asset counsel approves: an INR-backed token, or USDC with an FX layer (roadmap).

**ADR-04 No Redis / BullMQ in v1.** Rate limits live in memory per instance, plus DB-level
OTP attempt counters. Jobs use a Postgres advisory lock. This removes a moving part (Damyata).
Revisit when we run more than 3 API replicas.

**ADR-05 Vite SPA instead of Next.js.** No SEO needs behind login, and we want the smallest
JS for low-end Android. Fastify serves the built SPA, so it's one deployable.

**ADR-06 Account-based identity, not embedded wallets, in v1.** Privy/Dynamic aren't open
source. The PRD recommends custodial at MVP anyway. Customers are identified on-chain by an
HMAC-derived `customerRef`, so there's no private key to lose, and recovery means "log in again"
(Step 3 and Step 5). Self-custody via passkey smart accounts (ERC-4337, open-source
`permissionless`) is on the roadmap.

**ADR-07 DB-first with a hash-chained outbox.** See `03-ARCHITECTURE.md §2`.
