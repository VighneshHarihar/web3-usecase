# LoyalLink

**Loyalty rewards your local shop can't take back.**

Neighbourhood shops create offers like *"3 purchases totalling ₹1,500 this month → 20% off
your next bill (up to ₹300)"*. When a regular customer joins, the shop's money for that reward is
**locked in escrow** (a smart contract), so the customer knows the reward is real before they
spend. Customers sign in with a phone number, show a QR at the counter, and never see a wallet,
a token or a fee.

Built from the `Loyalink_PRD.md` and the design principles of *The Invisible Chain*
(both in [`docs/source/`](docs/source)). Everything is open source (MIT).

| For customers | For shop owners | For the platform |
|---|---|---|
| Phone + OTP sign-in, Hindi/English | 5-minute onboarding, UPI top-ups | KYC queue, freeze, payouts |
| Join offers, see progress, get notified | Offer builder in plain language | Escrow health and invariant checks |
| One QR for every shop | Counter screen: scan → bill → done | Chain relayer monitor and retry |
| Rewards guaranteed, ₹0 fees | Dashboard, customers, printable poster | Fraud flags |
| Public proof pages (optional) | Free plan + Pro (₹999/30 days) | 2% fee **only on redemption** |

## How it's built

```
apps/web      React + Vite PWA (customer app, shop dashboard & counter, ops console, proof pages)
apps/api      Fastify + Drizzle + PostgreSQL · hash-chained ledger · chain relayer · workers
packages/contracts   Solidity LoyaltyEscrow (immutable, OpenZeppelin) + Hardhat tests
packages/shared      Offer rules engine shared by API, UI and mirrored by the contract
e2e           Playwright: the whole story through the real UI
docs          Plan, principles, spec, architecture, business model, security, testing…
```

Start with [`docs/00-PLAN.md`](docs/00-PLAN.md) and [`docs/01-PRINCIPLES.md`](docs/01-PRINCIPLES.md).

## Run it locally

Requirements: Node 22, pnpm 10, PostgreSQL 16.

```bash
pnpm install
cp .env.example .env                 # defaults: sandbox payments, OTP shown on screen
createdb loyalink                    # or point DATABASE_URL at your Postgres
pnpm seed                            # demo shops, offers and a customer in progress

# optional, to enable on-chain escrow: in another terminal
pnpm chain                           # local Hardhat node on :8545, then set CHAIN_MODE=local in .env

pnpm dev                             # API on :8080, web on http://localhost:5173
```

Demo logins (the OTP is shown on screen because `OTP_DEV_ECHO=true`):

| Who | Phone |
|---|---|
| Customer (Hindi) | 98000 00002 |
| Shop owner (4 shops) | 98000 00001 |
| LoyalLink ops (admin) | 99999 00000 |

Try it: sign in as the customer on your phone-sized browser window, open **My QR**, then in another
window sign in as the shop owner → **Counter** → type the 6-digit code → record a ₹500 bill.

### Docker

```bash
docker compose up --build            # Postgres + dev chain + app on http://localhost:8080
docker compose exec app node dist/seed.js
```

## Tests

```bash
pnpm test        # shared rules (19), contract incl. randomized invariants (13), API vs real Postgres + chain replay (13), i18n (4)
pnpm e2e         # Playwright: onboard → approve → fund → launch → Hindi customer joins → 3 scans → reward → redeem → verify ledger
```

The API suite needs a Postgres at `postgres://postgres@127.0.0.1:5432/loyalink_test`
(override with `TEST_DATABASE_URL`). The e2e suite uses `loyalink_e2e` (`E2E_DATABASE_URL`).

## Deploy

See [`docs/11-DEPLOYMENT.md`](docs/11-DEPLOYMENT.md): single container + Postgres, Base Sepolia
for testnet, and the production checklist (audits, multisig, secrets, Razorpay, SMS).

## License

MIT. See [LICENSE](LICENSE).
