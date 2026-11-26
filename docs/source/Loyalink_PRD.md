# Loyalink — Product Requirements Document

> **Working name:** Loyalink (placeholder — feel free to rename). Throughout this doc, “the Protocol” refers to the smart contract layer, “the Platform” refers to the SaaS product on top.

-----

## 1. Executive Summary

Loyalink is a Web3 loyalty protocol that lets any small or medium merchant launch a **trust-minimised, pre-funded loyalty program** in minutes. Unlike traditional loyalty cards or app-based points (which depend entirely on the merchant honouring future promises), every reward is **escrowed on-chain at the moment a customer enrols in an offer**. Customers can verify the reward exists before they spend, and unspent rewards can be redeemed across a network of participating merchants — turning every shop’s loyalty program into a piece of a shared, interoperable rewards economy.

The product has three sides: merchants (who fund offers and gain repeat customers), customers (who get guaranteed, portable rewards), and the platform (which deploys infrastructure, takes a small fee, and curates the merchant network).

-----

## 2. The Problem

### Why traditional loyalty programs fail

- **No enforcement.** A coffee shop’s “buy 9 get 1 free” card is worthless if the shop closes, changes ownership, or quietly retires the promotion.
- **Trapped value.** Points earned at one merchant cannot be spent anywhere else. Customers end up with dozens of half-completed cards.
- **No transparency.** Customers cannot see how many other customers are mid-offer, whether the merchant can actually afford to honour rewards, or what the real conversion rates are.
- **High setup cost for SMBs.** Existing SaaS loyalty tools (Square Loyalty, Smile.io, LoyaltyLion) charge $50–$500/month and require POS integration. The local pizza place doesn’t bother.
- **Expiry abuse.** Programs are economically designed around customers *not* redeeming. The business model is breakage. This is hostile to customers.

### Why blockchain actually helps here (i.e. why this isn’t “blockchain for blockchain’s sake”)

- **Escrow** is a real native primitive of smart contracts — the merchant *cannot* renege.
- **Portability** of value across merchants requires a shared settlement layer; a blockchain is the cheapest neutral one.
- **Composability** — third-party apps can build on top (rewards aggregators, secondary markets for unused rewards, analytics).
- **Auditability** — both merchant and customer can independently verify program health.

### Why Web3 loyalty has failed before (and how Loyalink differs)

Past attempts (Blockchain-based loyalty pilots from Singapore Airlines, Loyyal, etc.) failed because they:

- Required customers to manage wallets and gas — Loyalink uses embedded wallets with gas sponsorship.
- Used custom volatile tokens — Loyalink uses stablecoins.
- Were B2E (enterprise) only with no consumer pull — Loyalink targets SMB merchants and consumer-facing UX from day one.

-----

## 3. Product Vision & Principles

**Vision:** Any merchant in the world can launch a guaranteed, portable loyalty offer in 5 minutes; any customer can earn rewards at one shop and spend them at another, with no app downloads or crypto knowledge required.

**Principles:**

1. **Invisible Web3.** A customer should be able to use Loyalink without ever knowing it touches a blockchain.
1. **Merchant funds are sacred.** Until a customer earns a reward, the merchant’s escrow is theirs and recoverable. After it’s earned, it’s the customer’s, period.
1. **No expiry weaponisation.** Expiry exists for working-capital reasons (merchants need to recycle stagnant offers), not as a profit lever.
1. **Open by default.** Public contracts, public APIs, optional indexers. Other apps can build on top.
1. **Mobile-first.** This is a phone product for both sides.

-----

## 4. User Personas

### Persona 1 — “Rohan, the independent merchant”

- **Profile:** Owns a single-location pizza shop in Pune. 32. Tech-comfortable but not technical. Uses WhatsApp Business, Razorpay, and Zomato.
- **Goals:** Convert walk-ins into repeat customers. Compete with chains. Run promotions without paying Zomato 25% commission.
- **Pains:** Has tried punch cards (lost), WhatsApp broadcasts (low engagement), Zomato Pro (too expensive). Doesn’t trust crypto but trusts “the technology behind crypto” if it solves a real problem.
- **Quote:** *“I just want my regulars to come back twice a month instead of once.”*
- **Crypto literacy:** Low. Wants to deal in INR/USD equivalents, not “tokens.”

### Persona 2 — “Anika, the multi-location chain operator”

- **Profile:** Marketing manager for a 14-store regional café chain. 28. Reports to a founder/CEO. Uses HubSpot, Shopify, Klaviyo.
- **Goals:** Increase customer lifetime value. Get cleaner attribution data. Run cross-store promotions (“earn at any location, redeem at any location”).
- **Pains:** Loyalty platforms are siloed per-store. Customers complain that points don’t transfer. CFO scrutinises every recurring SaaS line item.
- **Crypto literacy:** Medium. Knows what stablecoins are. Skeptical but curious.

### Persona 3 — “Dev, the urban professional customer”

- **Profile:** 27, software engineer in Bengaluru. Buys coffee daily, eats out 4×/week. Already has Cred, Paytm, MagicPin, half a dozen restaurant apps.
- **Goals:** Reduce app fatigue. Actually use rewards he’s earned instead of forgetting them. Likes the idea of “real” rewards over points.
- **Pains:** Forgets which app has what offer. Hates expiry. Suspicious of merchants gaming terms.
- **Crypto literacy:** Medium-high. Has a Coinbase account. Doesn’t want gas/seed-phrase friction.

### Persona 4 — “Mrs. Sharma, the casual customer”

- **Profile:** 54, school teacher. Uses smartphone for WhatsApp, YouTube, UPI. Doesn’t download new apps unless her kids set them up.
- **Goals:** Get the free pizza. That’s it.
- **Pains:** Anything that requires more than 2 taps. Forgetting passwords. Worrying she’ll “do something wrong” and lose money.
- **Crypto literacy:** Zero, and should stay that way.
- **Design implication:** She must be able to use this via a PWA link her son sends her, sign in with Google, and that’s the entire onboarding.

### Persona 5 — “Priya, the platform operator (internal team)”

- **Profile:** Loyalink ops team member. Onboards merchants, monitors contract health, handles disputes.
- **Goals:** Approve KYC’d merchants quickly. Detect fraud rings. Keep merchant escrow pools healthy.
- **Pains:** Merchants funding pools in the wrong currency. Customers calling about lost wallets. Cross-merchant settlement disputes.

-----

## 5. Use Cases & User Stories

### Merchant stories

- *As a merchant, I want to create a “Buy 3 large pizzas in 2 weeks → get 1 free” offer in under 5 minutes, paying for the rewards in INR via UPI, so I don’t have to learn what a wallet is.*
- *As a merchant, I want to see a real-time dashboard of how many customers are mid-offer, how much escrow is committed, and what my completion rate is.*
- *As a merchant, I want to top up my reward pool when it’s running low and pause new offers when I want to.*
- *As a merchant, I want to verify a customer’s purchase at the point of sale in under 5 seconds with a QR scan.*
- *As a merchant, I want to opt in or out of accepting cross-merchant rewards (e.g., a coffee shop accepting tokens earned at the pizza place down the road).*

### Customer stories

- *As a customer, I want to discover offers near me, see exactly what I need to do, and verify the reward is funded before I commit.*
- *As a customer, I want to enrol with one tap and have a wallet created for me invisibly.*
- *As a customer, I want to redeem a reward in-store by showing a QR code; no wallet jargon.*
- *As a customer, I want to use my rewards at a different participating merchant if the original one is closed/inconvenient.*
- *As a customer, I want a clear record of what I’ve earned and where I can spend it.*

### Platform stories

- *As a platform operator, I want to approve new merchants after KYC.*
- *As a platform operator, I want to monitor escrow health across all merchants and flag insolvency risk before it becomes a customer-facing problem.*
- *As a platform operator, I want to take a configurable fee on either funding, completion, or both.*

-----

## 6. Functional Requirements

### 6.1 PM perspective (what it does)

#### Merchant features

- **Onboarding & KYC.** Email/phone signup → business KYC (PAN/GST in India, equivalent elsewhere) → bank account or UPI link → wallet auto-provisioned (custodial during MVP, optional self-custody later).
- **Offer Builder.**
  - Trigger condition: number of purchases required, total spend threshold, time window.
  - Reward: stablecoin amount (displayed in local fiat equivalent), or a tiered set of rewards.
  - Constraints: per-customer limit, total enrolment cap, geographic restriction, time-of-day windows, blackout dates.
  - Cross-merchant redemption flag (yes / no / partner list).
- **Pool funding.** Pay in INR via UPI/Razorpay; platform converts to USDC and deposits into merchant’s contract instance. Display real-time “committed vs available” pool balance.
- **Point-of-sale verification.** Two modes:
  - *Merchant scans customer’s QR* — best for counter staff.
  - *Customer scans merchant’s QR* — best for delivery / no-staff scenarios.
  - Each scan triggers a “purchase event” attestation signed by merchant key.
- **Reward issuance.** Automatic on offer completion. Customer notified in-app.
- **Dashboard & analytics.** Active offers, customer funnel (enrolled → progressing → completed → redeemed), repeat-visit rate, average days-to-completion, escrow utilisation, cross-merchant inflow/outflow.
- **Payout / withdrawal.** Merchant can withdraw uncommitted pool balance back to INR at any time. Committed funds (already promised to customers mid-offer) are locked until either completion or expiry.

#### Customer features

- **Onboarding.** Open PWA or app → “Continue with Google/Apple/Phone” → embedded wallet provisioned silently in background → done.
- **Offer discovery.**
  - Map view of nearby participating merchants with active offers.
  - List view filtered by category (food, coffee, retail, services).
  - Search.
  - “Continue where you left off” — active offers prominently shown.
- **Offer enrolment.** Single tap. System checks merchant pool has capacity before allowing enrolment. If not, customer is queued or notified when capacity opens.
- **Progress tracking.** Visual progress bar (X of N purchases complete). Time remaining clearly shown. Push notifications at 50% and 75% complete, and 24h before expiry.
- **In-store redemption.** Tap “Redeem” → QR code displayed → merchant scans → confirmation animation.
- **Cross-merchant spending.** If reward is portable, customer sees a list of merchants where it can be spent. UX makes clear what the conversion is (1 reward unit = X at originating merchant, Y at partner merchant — see token economics).
- **Wallet view.** Total balance in fiat-equivalent, transaction history, “rewards about to expire” warning.
- **Recovery.** Lost device flow: re-authenticate via social login → wallet restored. Optional: export private key for advanced users.

#### Platform/admin features

- Merchant KYC review queue.
- Master contract deployment & upgrade management.
- Fee parameter management (per-offer, per-redemption, settlement spread).
- Fraud detection: pattern recognition on enrolment/redemption (e.g., same device fingerprint across many wallets).
- Customer support tooling: view a customer or merchant’s on-chain history with privacy controls.
- Dispute resolution: ability to freeze a merchant pool pending investigation.
- Cross-merchant settlement engine.

### 6.2 Technical perspective (how it works, no code)

**Contract architecture**

1. **LoyaltyFactory (master).** Singleton deployed once by the platform. Holds the canonical implementation of LoyaltyInstance via the [EIP-1167 minimal proxy pattern](https://eips.ethereum.org/EIPS/eip-1167) for cheap merchant deployment. Records every instance, enforces global parameters.
1. **LoyaltyInstance (per merchant).** Deployed via the factory. Stores the merchant’s offers, escrow pool, and customer enrolment state. Each merchant owns their instance via a role-based access control mechanism (OpenZeppelin AccessControl).
1. **EscrowVault.** Holds stablecoins for the merchant’s instance. Splits balance into `available` and `committed`. New enrolments check `available ≥ rewardAmount`, then move the funds to `committed`. On completion → moved to customer’s claimable balance. On expiry → returned to `available`.
1. **RewardToken (optional, phase 2).** ERC-20 representing redeemable balance, denominated in USDC at 1:1 backing. Allows secondary integrations.
1. **Registry & Discovery.** On-chain registry of participating merchants and their accepted cross-redemption partners.
1. **SettlementEngine (phase 2).** Handles cross-merchant redemption: when customer redeems at merchant B with rewards earned at merchant A, contract transfers USDC from A’s instance to B (minus any spread/fee).

**Off-chain components**

- **Indexer.** Subgraph (The Graph) or Goldsky to make on-chain state queryable in milliseconds for the UI.
- **Backend API.** Node.js / TypeScript. Handles: merchant profiles, KYC records, offer metadata (descriptions, images — too expensive to store on-chain), purchase event signing, push notifications, fiat on/off ramps.
- **Database.** Postgres for relational data (merchants, offers metadata, audit logs). Redis for caching and rate limits.
- **Fiat rails.** Razorpay (India) for INR ↔ USDC conversions. Stripe or equivalent for other regions. Custodial USDC pool that platform manages for instant fiat experience.
- **Auth & wallets.** Privy or Dynamic for embedded wallets + social login. Provides ERC-4337 smart accounts with optional recovery.
- **Gas sponsorship.** ERC-4337 Paymaster (Pimlico or Biconomy) — customers never pay gas. Platform absorbs gas cost, factored into the fee model.

**Chain choice.** Base (Coinbase L2) or Polygon PoS for MVP. Reasoning: EVM compatibility, sub-cent gas costs, mature tooling, real liquidity for USDC. Base preferred if targeting global, Polygon if targeting India where Polygon has stronger developer/partner ecosystem.

**Key technical guarantees**

- **Solvency invariant:** at all times, `EscrowVault.balance ≥ sum(committed) + sum(claimable but unredeemed)`. Enforced at the contract level — no enrolment can proceed otherwise.
- **No re-entrancy.** Standard OpenZeppelin ReentrancyGuard on all state-changing functions.
- **Upgrade path.** Instances are non-upgradeable (immutable trust). Factory can deploy a new implementation; existing merchants choose whether to migrate. This avoids the “merchant wakes up to find the contract changed under them” risk.

### 6.3 Marketer perspective (how it’s positioned and sold)

**Core narrative:** *“The first loyalty program your customers will actually trust.”*

**Merchant value proposition (top of funnel):**

- 5-minute setup, no POS integration required.
- Pay only when customers actually enrol — escrow is your money until then.
- Discover new customers from other shops’ networks.
- Real data, not just a punch card.

**Customer value proposition:**

- Guaranteed rewards. Verified on-chain before you start.
- One app for every shop you love.
- Earn at one place, spend at another.
- No points expiring out of nowhere.

**Pricing model (proposed):**

- Free tier: up to ₹10,000 / $120 in active escrow, 1 active offer, basic dashboard.
- Pro: ₹999 / $12 per month — unlimited offers, cross-merchant network, advanced analytics, priority KYC.
- Take rate: 2% on customer redemption (paid by merchant). Lower than Zomato/Swiggy commission, comparable to credit card processing.
- No fee on enrolment, no fee on funding (removes friction at the moment of commitment).

**Positioning matrix:**

|               |Loyalty SaaS (Smile, Square)|Aggregators (Cred, MagicPin)|**Loyalink**              |
|---------------|----------------------------|----------------------------|--------------------------|
|Trust guarantee|None                        |None                        |**On-chain escrow**       |
|Cross-merchant |No                          |Yes (closed)                |**Yes (open)**            |
|Setup time     |Hours-days                  |N/A (consumer)              |**Minutes**               |
|Customer cost  |Free                        |Free                        |**Free**                  |
|Merchant cost  |$50–$500/mo flat            |Revenue share + ads         |**$12/mo + 2% redemption**|

**Channels for merchant acquisition:**

- Direct sales in dense merchant clusters (food courts, high streets).
- Restaurant association partnerships (NRAI in India, equivalent abroad).
- Referral: existing merchants invite neighbouring merchants (revenue share).
- Content marketing: case studies showing repeat-visit-rate uplift.
- POS partner integrations (Petpooja, PineLabs in India).

**Channels for customer acquisition:**

- Always at the merchant. The pizza shop tells the customer “scan this for a guaranteed offer.”
- No paid customer acquisition in early stages — merchants are the distribution.
- Once merchant density is high in a city: organic discovery via map view, plus referral incentives.

-----

## 7. Token & Economic Model

### Reward unit

- All rewards denominated in **USDC**, displayed to users in local fiat (INR, USD) via real-time conversion shown to 2 decimals.
- No custom token at MVP. (Rationale: avoids securities-law exposure, volatility, and liquidity bootstrapping.)
- Future: optional governance / fee-discount token, only after meaningful merchant adoption.

### Merchant pool mechanics

- Merchant deposits USDC (purchased automatically from INR via UPI).
- Contract tracks `available` and `committed` balances.
- New customer enrolment moves `rewardAmount` from `available` → `committed`.
- Completion: moves from `committed` → customer’s claimable.
- Expiry without completion: moves from `committed` → `available` (reusable for next customer).
- Merchant can withdraw `available` at any time; cannot touch `committed`.

### Cross-merchant settlement

- When customer redeems rewards earned at Merchant A at Merchant B:
1. Contract verifies customer’s claimable balance ≥ redemption amount.
1. Transfers USDC from “A’s customer-claimable pool” → B’s `available`.
1. Optionally applies a “cross-network spread” (e.g., 5%) that goes to platform or to a network insurance fund.
- Merchant B can withdraw to fiat or use as their own pool for outgoing offers.

### Fee structure

- **Setup fee:** ₹0.
- **Pool funding fee:** ₹0 (platform takes spread on INR→USDC conversion, ~0.5%).
- **Customer enrolment fee:** ₹0.
- **Redemption fee:** 2% of redemption value, deducted from merchant.
- **Cross-merchant spread:** 1–5% configurable, split between platform and network insurance.
- **Subscription:** ₹999/mo for Pro features.

### Insurance / network safety

- A small percentage of all fees flows to a network insurance pool.
- Use cases: covers customer rewards if a merchant goes bankrupt with unredeemed customer balances (rare since funds are escrowed, but possible for cross-merchant accounting edge cases).

-----

## 8. Tech Stack (Recommended)

|Layer                                    |Technology                                        |Rationale                                                                                   |
|-----------------------------------------|--------------------------------------------------|--------------------------------------------------------------------------------------------|
|Smart contracts                          |Solidity 0.8.x, OpenZeppelin libraries            |Industry standard, audited primitives.                                                      |
|Contract framework                       |Foundry                                           |Faster compilation, better fuzz testing than Hardhat.                                       |
|Chain                                    |Base (production), Base Sepolia (testnet)         |Coinbase-backed L2, growing consumer ecosystem, low gas. Polygon as alternate.              |
|Account abstraction                      |ERC-4337 via Pimlico or Biconomy                  |Gasless UX, social recovery, batched transactions.                                          |
|Embedded wallets                         |Privy or Dynamic                                  |Social login + invisible wallet provisioning. Privy has better React Native support.        |
|Indexing                                 |The Graph (hosted Subgraph) or Goldsky            |Sub-second query of on-chain state.                                                         |
|Frontend (web/PWA)                       |Next.js 14, wagmi, viem, TailwindCSS, shadcn/ui   |Modern, fast, type-safe Web3 React stack.                                                   |
|Mobile                                   |React Native (Expo) or PWA-first                  |PWA at MVP to avoid app-store friction for Mrs. Sharma; native app once growth justifies it.|
|Backend                                  |Node.js, Fastify or Hono, TypeScript              |Aligned with frontend stack, low cold-start latency.                                        |
|Database                                 |Postgres (Supabase or AWS RDS)                    |Relational data, mature ecosystem.                                                          |
|Cache / queue                            |Redis, BullMQ                                     |Rate limiting, async job processing for KYC, fiat conversion.                               |
|Fiat rails (India)                       |Razorpay                                          |UPI, cards, instant settlement.                                                             |
|Fiat rails (global)                      |Stripe, Ramp, Transak                             |On-ramp for USDC.                                                                           |
|Identity / KYC                           |Persona, Sumsub, or Onfido                        |Business KYC for merchants.                                                                 |
|Monitoring                               |Tenderly (contract), Sentry (app), Datadog (infra)|Realtime alerts on contract anomalies.                                                      |
|Notifications                            |OneSignal or in-house via Firebase                |Push notifications for offer progress.                                                      |
|Analytics                                |PostHog or Mixpanel + custom on-chain dashboards  |Product + protocol metrics.                                                                 |
|Security audit (mandatory before mainnet)|OpenZeppelin, Trail of Bits, or Code4rena         |Two independent audits before handling real money.                                          |

-----

## 9. UI/UX Specification (handoff-ready)

> This section is intentionally written so a designer (or another Claude instance) can build a prototype from it. Each screen is described by purpose, key elements, primary CTA, and edge-case states.

### 9.1 Visual direction

- **Tone:** Warm, trustworthy, modern. Not “crypto-coded” — avoid neon, glassmorphism, “Web3” purple-and-black aesthetic. Think Revolut meets a local café menu.
- **Palette:** Neutral base (off-white, near-black) with one bright accent (e.g., a warm coral or trustworthy green) for primary CTAs. Avoid blue (overused in fintech and Web3).
- **Typography:** Sans-serif. Inter for UI, optional serif for marketing/landing.
- **Imagery:** Real photos of merchants and food, not stock crypto illustrations.
- **Iconography:** Outline icons, consistent stroke weight. Heroicons or Lucide as a starting set.

### 9.2 Customer app — screen flow

#### S1. Splash / Onboarding

- Logo, single tagline (“Rewards you can trust”).
- Two CTAs: “Continue with Google”, “Continue with Phone”.
- Tiny footer link: “Already have a wallet? Connect.”
- *Edge: returning user → skip to home.*

#### S2. Permission & location

- One screen requesting location (for nearby offers).
- Skippable. If skipped, defaults to list view by city.

#### S3. Home (logged in)

- **Top:** Greeting (“Hey Dev”), wallet balance pill (“₹240 ready to spend”).
- **Hero card:** “Continue your offer” — shows active in-progress offer with progress bar, days remaining, next step (“2 more pizzas to go”).
- **Section:** “Nearby offers” — horizontal scroll of merchant cards (logo, offer headline, distance, ✓ verified badge).
- **Section:** “Featured merchants” — curated picks.
- **Bottom nav:** Home, Map, Wallet, Profile.

#### S4. Offer detail

- Merchant header (logo, name, rating, distance, hours).
- Offer headline: “Buy 3 large pizzas in 14 days, get ₹450 back.”
- **Trust badge:** “✓ Reward escrowed on-chain. View proof →” — tappable, opens explainer.
- Terms section (collapsible): per-customer limit, blackout dates, cross-redemption allowed at: [list].
- Primary CTA: “Start offer” — bottom-fixed.
- *Edge: pool full → CTA becomes “Join waitlist” with note “12 spots ahead of you.”*
- *Edge: customer already enrolled → CTA becomes “View progress.”*

#### S5. Enrolment confirmation

- Full-screen success animation.
- “You’re in. The reward of ₹450 is reserved for you for 14 days.”
- “Show this to the shop on your next visit:” → tap to reveal QR code.

#### S6. Active offer progress

- Large progress ring or bar (2 of 3 complete).
- Timeline of completed purchases (timestamp, amount).
- Countdown to expiry.
- “Show purchase QR” button — opens a freshly signed QR for the next visit.
- Cancel option (small text link, with confirmation modal explaining the offer will close).

#### S7. Redemption (in-store)

- Big button: “Redeem reward.”
- Tap → QR appears with countdown (e.g., 60 seconds to scan).
- After merchant scans → success animation, balance updated.

#### S8. Wallet

- Balance in local fiat. Small “show in USDC” toggle for the curious.
- Tabs: “Rewards” (claimable balances per merchant), “History” (chronological).
- “Spend at another shop” button → opens map filtered to merchants accepting your rewards.
- Expiry warnings highlighted in red.

#### S9. Map view

- Standard map with custom pins per merchant.
- Filter chips at top: Food / Coffee / Retail / Services / Accepts cross-rewards.
- Tap pin → mini-card → tap → S4 (offer detail).

#### S10. Profile

- Name, avatar (from Google/social).
- Settings: notifications, language, currency display, export wallet (advanced).
- Help, T&Cs, log out.

### 9.3 Merchant dashboard — screen flow

#### M1. Onboarding wizard (post-signup)

- Step 1: Business details (name, category, address, GST/PAN).
- Step 2: KYC document upload.
- Step 3: Bank/UPI link.
- Step 4: “Fund your first offer” — optional, can skip.
- Step 5: Welcome screen with checklist of “first steps.”

#### M2. Dashboard home

- Top KPIs (cards): Active offers, Customers mid-offer, Pool balance (available / committed), This month’s repeat-visit rate.
- Funnel chart: Enrolled → Progressing → Completed → Redeemed.
- Recent activity feed.
- Primary CTA: “Create new offer.”

#### M3. Offer builder

- Step 1: Trigger (“What does the customer need to do?”) — type (count of purchases, total spend), threshold, time window.
- Step 2: Reward (“What do they get?”) — amount in INR, preview in USDC.
- Step 3: Limits — per-customer cap, total enrolment cap, blackout windows.
- Step 4: Cross-redemption — toggle and partner list.
- Step 5: Funding — calculate required pool (“for 100 customers, you need to fund ₹45,000”), fund via UPI.
- Review screen → “Launch offer.”

#### M4. Offer detail (merchant view)

- Headline, status, all funnel metrics.
- List of enrolled customers (anonymised: “Customer #2341, 2 of 3 done, 4 days left”).
- Edit (only certain fields editable; major changes require closing offer and launching a new one — communicated clearly).
- Pause/Resume.

#### M5. Pool management

- Available / Committed split, visualised.
- Top-up button (UPI).
- Withdraw available balance to bank.
- History of pool movements.

#### M6. Point-of-sale (mobile-optimised)

- Big “Scan customer QR” button → opens camera.
- After scan → confirm purchase amount (if relevant) → tap confirm → success.
- Recent scans list.

#### M7. Analytics

- Repeat-visit rate over time.
- Average days to completion.
- Customer cohorts (new vs returning).
- Cross-merchant inflow/outflow (if cross-redemption enabled).
- Exportable CSV.

#### M8. Settings

- Business profile, team members, payout settings, notification preferences, API keys (phase 2).

### 9.4 Critical interaction patterns

- **Trust badges everywhere.** Any time a reward, balance, or commitment is shown to a customer, accompany with a “✓ Verified on-chain” affordance.
- **No crypto jargon in default UI.** Words to avoid: wallet (use “account”), gas (hide entirely), token (use “reward” or “balance”), blockchain (use “verified” or “secured”). Reveal these terms only in optional “advanced” views.
- **Optimistic UI.** Don’t make users wait for chain confirmation visually; show success immediately and reconcile in background. (Backend retries on failure with strong observability.)
- **Recovery friendliness.** Lost-phone flow should be 3 taps maximum: open app on new device → social login → done.

### 9.5 Accessibility

- WCAG 2.1 AA minimum.
- All flows usable with screen readers.
- Minimum tap target 44×44pt.
- Sufficient colour contrast (especially for trust badges, which carry semantic meaning).

-----

## 10. Test Cases

### Happy-path

1. **Merchant signup → first offer live.** Rohan signs up, completes KYC in 24h, creates a 3-pizza offer, funds ₹10,000 via UPI, sees the offer go live.
1. **Customer enrolment → completion → redemption.** Dev sees offer, taps Start, buys 3 pizzas over 10 days (each verified via QR scan at counter), receives ₹450, redeems it at the same shop on the next visit.
1. **Cross-merchant redemption.** Dev earns ₹450 at pizza shop, walks to coffee shop next door, opens the app, sees “Spend here,” redeems ₹120 for a coffee. Coffee shop receives ₹120 USDC into their pool.
1. **Failed offer → escrow released.** Dev starts a 3-pizza offer, only buys 2 in 14 days, offer expires, the ₹450 returns to merchant’s available pool, freed up for the next enrolment.

### Edge cases (functional)

1. **Pool runs out mid-day.** Merchant has pool for 100 customers, the 101st tries to enrol → contract rejects → app shows “Join waitlist” → when a current customer either completes (no change to available) or expires (pool restores), waitlist auto-promotes the next customer.
1. **Customer enrols but pool depleted before completion due to merchant withdrawal.** Should be **impossible by contract design** — committed funds cannot be withdrawn. Test verifies merchant withdrawal of `committed` is rejected.
1. **Merchant tries to change offer terms with active customers.** UI prevents destructive changes; protocol enforces that active enrolments use the snapshot of terms at enrolment time.
1. **Customer device lost.** User logs in on new device via social login. Wallet restored via Privy/Dynamic recovery. All claimable balances intact.
1. **Customer creates multiple accounts to claim “new customer” bonus.** Device fingerprinting + phone-number uniqueness + behavioural analysis flag suspicious patterns. New-customer offers limited per phone number.
1. **Merchant goes out of business with committed escrow.** Customers can still redeem their existing claimable balances at the original merchant (funds are on-chain). New enrolments stop. Cross-redemption flag (if on) routes customers to spend at other merchants.
1. **Refund.** Customer returns a pizza. Merchant initiates “void scan” in dashboard → that purchase event is invalidated → progress reverts → if reward was already issued, contract has a configurable “claw-back window” (e.g., 24h) where the merchant can revoke. Beyond the window, the reward is irrevocable (customer-trust principle).
1. **Network congestion / RPC failure.** Backend retries; user sees “Saving…” then either success or “Couldn’t save your scan, try again.” Critical writes (escrow commitments) idempotent.
1. **Stablecoin depeg.** USDC briefly trades below $1. Reward amounts are still nominal USDC; merchant pool is denominated in USDC. UI shows fiat estimate based on real-time peg. (Document this risk clearly to merchants.)
1. **Gas price spike on L2.** Paymaster absorbs; if costs exceed thresholds, system queues low-priority transactions until prices normalise.
1. **Merchant pauses an offer.** Existing enrolments continue per their snapshot. No new enrolments. Communicated clearly to customers.
1. **Time zone edge cases.** All expiries are timestamped in UTC at contract level; UI displays in user’s local TZ.
1. **Customer’s offer expires while in store.** Final purchase scanned at 11:59:30 PM for an offer expiring at midnight. Contract uses block timestamp; clock skew handled with a small grace period (e.g., 60 seconds).
1. **Two simultaneous redemptions of the same balance.** Double-spend prevented by contract-level nonces / balance updates per transaction.

### Adversarial / security

1. **Sybil attack on new-customer bonuses.** See test 9; multi-layered defences.
1. **Merchant–customer collusion to drain pool.** Merchant scans fake purchases for a friend to drain their own pool. *This is the merchant’s own money — there’s no protocol-level harm.* They’re just gifting their own funds. Platform may detect and warn but it’s not a protocol exploit.
1. **Front-running enrolment.** When pool is near full, malicious user MEV-front-runs others. Mitigated by L2 (sequencer ordering, not public mempool) and by the queue/waitlist mechanism.
1. **Contract bug post-deploy.** Mitigation: two audits, bug bounty (Immunefi), pause guardian role on factory that can pause new instances but cannot touch existing user funds.
1. **Reentrancy on redemption.** Standard ReentrancyGuard; tested via Foundry invariant tests.
1. **Phishing site impersonating Loyalink.** Domain monitoring, in-app deep linking, warning when wallet sees unfamiliar contract address.

### Regulatory / compliance

1. **GST treatment of rewards.** Confirm with tax counsel: is a redeemed reward a discount (no GST on the discount portion) or income? Document for merchants.
1. **AML / KYC.** Merchant onboarding requires business KYC. Customer onboarding KYC only triggered above a threshold (e.g., ₹50,000 cumulative annual redemptions) to keep low-value flows frictionless.
1. **Indian crypto regulation (current as of 2026).** Use of stablecoins as a unit of account requires careful framing. Document recommends merchants are paid out in INR for accounting purposes; the stablecoin is a settlement primitive, not a customer-facing instrument. Consult counsel for the latest position.

-----

## 11. Risks & Mitigations

|Risk                                      |Probability     |Impact      |Mitigation                                                                                                     |
|------------------------------------------|----------------|------------|---------------------------------------------------------------------------------------------------------------|
|Smart contract exploit                    |Low (post-audit)|Catastrophic|Two independent audits, bug bounty, pause guardian, formal verification of invariants.                         |
|Stablecoin depeg                          |Low             |High        |Diversify to a basket (USDC + USDT) in phase 2; communicate risk to merchants.                                 |
|Regulatory shift (India crypto rules)     |Medium          |High        |Build with the ability to switch settlement layer; maintain fiat-only fallback path; legal counsel on retainer.|
|Slow merchant adoption                    |High            |High        |Concentrate on dense merchant clusters in one city first (Pune, Bengaluru, or Singapore). Direct-sales motion. |
|Customer onboarding friction              |Medium          |High        |Continuous UX testing; embedded wallets non-negotiable.                                                        |
|Cross-merchant settlement disputes        |Medium          |Medium      |Clear T&Cs; in-protocol arbitration via platform admin role; insurance pool.                                   |
|Fraud rings                               |Medium          |Medium      |Device fingerprinting, phone uniqueness, ML on transaction patterns, per-customer caps.                        |
|Cost of gas sponsorship eating into margin|Medium          |Medium      |L2 keeps gas tiny; budget cap per merchant on sponsored gas; charge merchant if exceeded.                      |

-----

## 12. Compliance & Legal Considerations

- **Jurisdictions of MVP:** Pilot in India and one international market (Singapore or UAE) with clearer crypto stances.
- **Required:**
  - Merchant T&Cs covering offer modification rights, refund handling, payout terms.
  - Customer T&Cs covering reward portability, expiry, dispute resolution.
  - Privacy policy compliant with India DPDP Act and GDPR (for international).
  - PCI scope limited to fiat on-ramp (handled by Razorpay/Stripe).
  - VASP / virtual asset registration if required by jurisdiction.
- **Tax:**
  - GST on platform fees (collected from merchants).
  - Reward redemptions treated as discounts where possible (more favourable than treating as income).
  - 1% TDS on crypto transactions in India — *currently the platform should structure to avoid customer-facing crypto exposure to keep TDS off the customer*; merchants funding in INR sidestep this for customers.

-----

## 13. Go-to-Market Strategy

### Phase 0 — Stealth pilot (months 0–3)

- 1 city. 10 hand-picked merchants (mix of food, coffee, retail).
- Closed beta of ~200 customers (founder networks).
- Goal: prove escrow + redemption flow works end-to-end, measure repeat-visit lift.

### Phase 1 — Single-city density (months 3–9)

- Scale to 100 merchants in one neighbourhood / 2–3 km radius.
- Open consumer signups via merchant QR codes.
- Introduce cross-merchant redemption.
- Goal: 30% repeat-visit-rate lift for participating merchants, 50% offer completion rate, NPS > 40.

### Phase 2 — Multi-city (months 9–18)

- Expand to 3–5 cities, focusing on dense food/retail areas.
- POS partner integrations (Petpooja, PineLabs).
- Launch chain merchant tier (Anika persona).

### Phase 3 — Protocol opening (months 18+)

- Public API, third-party developer ecosystem.
- Optional governance token.
- International expansion (Singapore, UAE, Dubai).

-----

## 14. Success Metrics

### North-star

- **Cumulative customer reward value redeemed (USD).** This is the single number that captures real value flowing through the system.

### Merchant-side

- Repeat-visit-rate lift (target: +30% vs pre-Loyalink baseline).
- Offer completion rate (target: > 40%).
- Pool utilisation (target: 60–80% committed at any given time).
- Merchant retention at 6 months (target: > 70%).

### Customer-side

- Activation: % of installs who complete first enrolment (target: > 50%).
- Retention: 30-day return rate (target: > 35%).
- Cross-merchant redemption rate (target: > 15% of redemptions in dense areas).
- NPS (target: > 40).

### Platform-side

- Gross redemption value processed (monthly).
- Take rate revenue.
- Cost per gas-sponsored transaction (target: < ₹0.50).
- Time from merchant signup to first live offer (target: < 24h).

-----

## 15. Phased Roadmap (high level)

|Phase     |Months|Deliverables                                                                                   |
|----------|------|-----------------------------------------------------------------------------------------------|
|Foundation|0–3   |Smart contracts (audited), customer PWA, merchant dashboard, single-merchant flow, INR on-ramp.|
|Network   |3–6   |Cross-merchant redemption, settlement engine, indexer, analytics dashboards.                   |
|Scale     |6–12  |POS integrations, mobile native apps, multi-city ops tooling, chain-merchant features.         |
|Protocol  |12–18 |Public API, partner integrations, governance considerations, geographic expansion.             |

-----

## 16. Open Questions / Decisions Needed Before Build

1. **Custodial vs non-custodial wallets at MVP.** Recommendation: **custodial via Privy/Dynamic with social recovery**. Faster onboarding, better recovery UX. Sacrifices ideological purity for adoption. Confirm before build.
1. **Reward currency.** Recommendation: **USDC only**. Confirm.
1. **Chain.** Base vs Polygon. Recommendation: **Base** for global, **Polygon** if India-first. Confirm based on go-to-market.
1. **Refund / clawback window.** How long after reward issuance can a merchant void? Recommendation: 24h. Negotiate.
1. **Cross-merchant default.** Should new merchants default to “accept cross-network rewards” on or off? Recommendation: **off**, opt-in (lower friction for merchant fears, higher friction for network effect — but builds trust). Open for debate.
1. **KYC threshold for customers.** What’s the cumulative annual redemption value above which customer KYC kicks in? Recommendation: ₹50,000.
1. **Pricing model.** Subscription + take rate vs pure take rate. Recommendation: tiered as documented above.
1. **Brand name.** Loyalink is a placeholder. Recommend trademark search and final naming workshop before any marketing.
1. **First city.** Pune (hometown advantage), Bengaluru (consumer crypto density), or international (Singapore for regulatory clarity)? Strategic decision tied to fundraising story.
1. **Funding model.** Bootstrapped, angel, or VC? Affects timeline and pricing aggressiveness.

-----

## 17. Appendix: Glossary (for internal alignment)

- **Instance:** A per-merchant smart contract holding offers, escrow, and customer state.
- **Pool:** A merchant’s escrowed USDC.
- **Available pool:** Funds not yet committed to active enrolments — withdrawable.
- **Committed pool:** Funds locked against active customer enrolments — not withdrawable.
- **Claimable balance:** Customer-owned reward, redeemable.
- **Cross-redemption:** Spending claimable balance at a different merchant.
- **Paymaster:** ERC-4337 component that pays gas on behalf of the customer.
- **Escrow invariant:** Mathematical guarantee that the on-chain balance always covers all promises made.

-----

*Document version 0.1 — to be refined with stakeholder input.*