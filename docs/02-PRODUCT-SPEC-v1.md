# 02 · Product spec, v1.0

**One line:** LoyalLink lets a neighbourhood shop promise its regulars a reward
("3 visits totalling ₹1,500 this month → 20% off your next bill") and **lock the money
for it up front**, so the customer knows the reward is real before they spend.

## 1. Scope

### Must (v1.0, built)
| # | Capability | Principle |
|---|---|---|
| M1 | Phone + OTP sign-in for everyone (customers, staff, owners, admins) | Salt, Guest |
| M2 | Shop onboarding: business details, optional GSTIN/PAN, UPI ID for payouts → admin review | Dharma (KYC'd strong party) |
| M3 | Offer builder: conditions = min purchases + min total spend + min per-bill amount + window; reward = fixed ₹ credit **or** % discount with ₹ cap; limits = max customers, per-customer repeats, reward validity | Food |
| M4 | Reward pool: top up via UPI (Razorpay, or sandbox in dev), see available / committed / owed, withdraw available | R1, R2 |
| M5 | Customer discovery: nearby list (geolocation optional), categories, search, shop page via poster QR | Guest |
| M6 | One-tap join, with a funded-capacity check; waitlist when full | R1 |
| M7 | Counter (POS): scan the customer QR or type the 6-digit code → record purchase → automatic reward on completion | R3, Witness |
| M8 | Redeem at counter: enter bill → discount computed → reimbursement to the merchant pool minus 2% fee | R5 |
| M9 | 24 h void window for refunds (reverts progress, revokes an unused reward) | Awe |
| M10 | Customer: progress, rewards, history, in-app notifications (50% / 75% / done / expiring) | Guest |
| M11 | Public proof pages + hash-chained public ledger + on-chain mirror | Witness |
| M12 | Merchant dashboard: KPIs, funnel, activity, customers (anonymised), CSV export (Pro) | |
| M13 | Plans: Free / Pro (₹999 per 30 days), limits enforced | Business model |
| M14 | Admin: KYC queue, freeze/unfreeze, payouts queue, ledger health and retry, fraud flags | |
| M15 | Hindi + English, PWA installable, data export, account deletion | Guest, Fullness |
| M16 | Staff accounts (owner invites by phone; staff can use the counter only) | Witness (attribution) |

### Won't (v1.0). See `12-ROADMAP.md`
Cross-merchant redemption · self-custody / passkey smart accounts · web-push · native apps ·
POS integrations · USDC with FX conversion · document upload for KYC · tiered rewards ·
blackout hours · geo-fenced offers · multi-location chains.

## 2. Offer rules (canonical)

Implemented once in `packages/shared/src/rules.ts` and mirrored in `LoyaltyEscrow.sol`.
All money is in **paise** (integer).

```
Offer {
  minPurchases       ≥ 1            // number of qualifying bills
  minTotalSpend      ≥ 0            // sum of qualifying bills
  minPurchaseAmount  ≥ 0            // a bill below this doesn't count (anti ₹1-gaming)
  windowDays         1..365         // from the moment of joining
  rewardKind         credit | percent
  rewardValue        > 0            // credit: amount; percent: CAP (this is what is escrowed)
  percentBps         1..10000       // percent only
  rewardValidityDays 30..365        // earned reward lifetime (contract min 30d: no expiry weaponisation)
  maxEnrolments      ≥ 1
  perCustomerLimit   ≥ 1            // how many times one customer may complete it
  feeBps             snapshot of platform fee at publish (≤ 300)
}
```

- **Joining** reserves `rewardValue` from the pool (`available → committed`). It is refused if
  the pool can't cover it, the offer isn't live, the cap is reached, the customer already has an
  active enrolment on it, or they've hit `perCustomerLimit`.
- **A purchase** counts if `amount ≥ minPurchaseAmount` and `at ≤ deadline + 60 s grace`.
  One counter scan applies the bill to **every** active enrolment the customer has at that shop.
- **Completion** happens when `purchases ≥ minPurchases AND spend ≥ minTotalSpend`. The reward
  is issued in the same step (`committed → owed`), with `expiresAt = at + validity`.
- **Expiry** (after deadline + grace) returns the reservation (`committed → available`).
- **Cancel** (customer) returns the reservation immediately.
- **Redeem**
  - credit: `use = min(remaining, bill)`; partial use allowed.
  - percent: `discount = min(floor(bill × bps / 10000), cap)`; single use, and the unused
    cap returns to the merchant's available.
  - The merchant is reimbursed `use − fee` into *available*; `fee = floor(use × feeBps / 10000)`.
- **Void** (≤ 24 h after the purchase): removes it from every enrolment it counted for. If that
  un-completes an enrolment whose reward is still unused, the reward is revoked
  (`owed → committed`). If the reward is already used, the void is refused for that enrolment.
- **Reward expiry**: the remaining value returns to the merchant (`owed → available`). The
  customer is reminded 7 days and 1 day before.

### Worked example (the user's example)
Shop "Sharma General Store" publishes: *3 purchases, total ≥ ₹1,500, each ≥ ₹200, within 30 days
→ 20% off next bill, up to ₹300, valid 60 days*. Escrow per customer = ₹300.

- Day 1 bill ₹600, day 9 bill ₹450, day 20 bill ₹520. That's 3 bills and ₹1,570, so complete.
  The coupon is issued.
- Day 25 bill ₹1,200 → 20% = ₹240 ≤ ₹300 cap. The customer pays ₹960. The merchant is
  reimbursed ₹240 − ₹4.80 fee = ₹235.20 and gets the unused ₹60 of cap back.
  Net cost to the merchant for a loyal customer worth ₹2,770: **₹244.80 (8.8%)**.

## 3. Screens

### Customer (PWA, mobile-first)
| Route | Screen | Notes |
|---|---|---|
| `/` | Landing (logged out) / Home (logged in) | Home: greeting, "₹X ready to use", in-progress hero, nearby offers, rewards |
| `/login` | Phone → OTP | Name asked once, optional |
| `/explore` | Offer list with category chips + search + "near me" | |
| `/offer/:id` | Offer detail | Plain sentence, "✓ Reward secured" → proof sheet, Join / Waitlist / View progress |
| `/s/:slug` | Shop page (poster QR target) | |
| `/qr` | "Show at counter" | Big QR + 6-digit code, auto-refresh, live updates after a scan |
| `/progress/:id` | Enrolment progress | Ring, purchases timeline, deadline, cancel |
| `/rewards` | Rewards | Coupons/credits by shop, expiry warnings |
| `/activity` | History | |
| `/alerts` | Notifications | |
| `/profile` | Name, language, download data, delete account, log out, "I own a shop" | |
| `/proof/...` | Public witness pages | The only place chain words appear |

### Merchant (responsive, sidebar on desktop and bottom bar on phone)
| Route | Screen |
|---|---|
| `/merchant` | Picks the shop / starts onboarding |
| `/merchant/new` | Onboarding wizard (details → payout → review) |
| `/m/:mid` | Dashboard: KPIs, funnel, activity, "Create offer" |
| `/m/:mid/counter` | Counter (POS): scan / code, record purchase, redeem, recent scans + void |
| `/m/:mid/offers` · `/new` · `/:oid` | Offers list, builder (4 steps + review), detail |
| `/m/:mid/pool` | Pool: split bar, add money, withdraw, movements |
| `/m/:mid/customers` | Anonymised customers, CSV export (Pro) |
| `/m/:mid/settings` | Profile, team, plan, poster |
| `/m/:mid/poster` | Printable A5 poster with QR |
| `/pay/:id` | Payment page (Razorpay checkout or sandbox simulator) |

### Admin
`/admin` overview · `/admin/merchants` · `/admin/payouts` · `/admin/ledger` · `/admin/flags`

## 4. Edge-case behaviour (PRD §10 mapping)

| PRD test | v1 behaviour |
|---|---|
| Pool runs out | Join refused with "Join waitlist". When capacity returns, waitlisted users get a notification and the first to tap gets in |
| Merchant withdraws committed | Impossible: API checks and the contract reverts (`InsufficientAvailable`) |
| Terms changed with active customers | Only title/description are editable after publish. Numeric terms are immutable (snapshot), and you end the offer and publish a new one |
| Device lost | Log in with the same phone and everything is there (account-based) |
| Multi-account sybil | One account per phone, per-customer limit, scan velocity flag |
| Merchant closes | Frozen/closed merchants keep honouring: redemption and expiry still work, new joins stop |
| Refund | Void within 24 h (see rules) |
| RPC failure | DB commits, outbox retries with backoff, UI shows "Saved", admin shows lag |
| Time zones | Everything stored in UTC (timestamptz / unix seconds), displayed in Asia/Kolkata or the device TZ |
| Expiry at 23:59:30 | 60 s grace on chain and in the DB |
| Double redemption | Row lock on the reward + contract status check |
