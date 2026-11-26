# 01 · Principles — The Invisible Chain, applied to LoyalLink

The PRD (`Loyalink_PRD.md`) tells us *what* to build. **The Invisible Chain** tells us *how
to decide*. Wherever the two disagree, the Invisible Chain wins. This document runs
LoyalLink through its seven steps and the "Da, da, da" release checks, and records the
design rules each step produced. Every rule below is referenced from the other docs.

---

## Step 1 · Dharma — who is weak, who is strong? (Bṛhadāraṇyaka 1.4.14)

> **"Regular customers can't trust a shop owner to honour the reward they were promised
> once they have done what was asked."**

| | |
|---|---|
| **Weak party** | The loyal customer: Mrs. Sharma, Dev. They spend first and are promised value later. |
| **Strong party** | The shop owner, who writes the terms, holds the money and can quietly retire a promotion, lose the punch card, or "forget". |
| **Secondary imbalance** | Merchant ↔ platform: the platform could raise fees or seize pooled money. |

**The rules that must never bend** (enforced by the smart contract, not by our code):

1. **R1 · Funded before promised.** A customer can only join an offer if the reward is already
   escrowed for them (`available ≥ reward` moves to `committed`).
2. **R2 · Committed money is untouchable.** A merchant can withdraw only `available`
   money, never money committed to a customer in progress.
3. **R3 · Earned is owned.** When the terms are met the reward is issued automatically, with no
   approval step. After a 24 h refund window it cannot be revoked by anyone.
4. **R4 · Terms are frozen at enrolment.** Editing or pausing an offer never changes the
   deal for someone who has already joined.
5. **R5 · The platform's take is capped in code.** The redemption fee is snapshotted per
   offer and can never exceed `MAX_FEE_BPS = 3%`. The guardian can pause *new* activity, but
   it can never move user funds.

*Test:* Can we name a real person who loses money today because the stronger side controls
the record? Yes. Anyone with a lost or ignored punch card, or a "points devalued" email.

## Step 2 · Food, not tokens (Taittirīya 3.9)

Buying milk, bread, coffee, thalis and haircuts from the same shop is a **weekly habit**.
LoyalLink makes that habit pay off without asking anyone to want "crypto".

- **No custom token. No speculation. No "earn" loops.** Rewards are rupees or a percentage
  discount, and that's all.
- The settlement unit is a rupee-pegged stable unit (1 unit = ₹1, 2 decimals). See ADR-03.

*Test:* Would someone use this every week without ever hearing the word "blockchain"? Yes.
It's a loyalty card that can't be lost.

## Step 3 · Dissolve the chain like salt (Chāndogya 6.13)

The chain must be tasted in every sip and seen in none.

| What the user sees | What is dissolved underneath |
|---|---|
| "Continue with phone number" + OTP | A platform account. The customer is identified on-chain only by `customerRef = HMAC(userId)`, so there are no addresses or keys to manage |
| "₹0 fees for customers" | The platform relayer pays all network fees (gas sponsorship) |
| ₹ amounts, shop names, dates | Token units, bytes32 ids, block timestamps |
| "✓ Reward secured" tick | `LoyaltyEscrow` state + tx hash, shown only on the optional proof page |
| "Show this QR at the counter" | A short-lived presence code; the merchant's scan triggers an attested purchase event |
| "Lost your phone? Just log in again" | Accounts are tied to the phone number, not to a device key |

**Banned words in default UI:** wallet, gas, token, blockchain, crypto, USDC, address,
transaction, hash. Allowed only on `/proof/*` pages and in "Advanced" sections.
(Enforced by a unit test over the i18n dictionaries.)

*Test:* A first-time user finishes "join offer → show QR → get reward" without asking
what any word means.

## Step 4 · Use both worlds (Īśā 9–11)

| Job | Familiar web (avidyā) | Chain (vidyā) |
|---|---|---|
| Sign-in | Phone OTP, cookies | nothing |
| Money in/out | UPI via Razorpay (sandbox in dev), bank payout | Escrow balances: available / committed / owed |
| Speed & search | Postgres, normal API | nothing |
| Offer terms | Descriptions, images, i18n text | Numeric terms + `termsHash` (keccak of the canonical JSON) |
| Customer data | Phone, name, encrypted at rest, off-chain | `customerRef` hash only, never PII |
| Purchases | POS scan UX | `recordPurchase` with amount + time |
| Help & disputes | Humans (admin console, support) | The record both sides can point to |

**Design rule:** an operation lands in Postgres first (fast, optimistic UI) and is written
to an append-only, hash-chained **ledger outbox**. A worker mirrors it to the contract,
where the same rules are enforced again. If they disagree the contract wins, and the admin
console raises a divergence alert.

*Test:* Is every on-chain part there because it protects the customer (Step 1)? Yes. The
contract holds only R1–R5 state and nothing else.

## Step 5 · Treat the user as a guest (Taittirīya 1.11)

| Way of giving | LoyalLink rule |
|---|---|
| With honour (śraddhā) | Plain language. Offers are always shown as a human sentence: "Make 3 purchases totalling ₹1,500 within 30 days → get 20% off your next bill (up to ₹300)". |
| In plenty (śrī) | Customers pay ₹0, always. Merchants get a free tier (1 offer, ₹10k escrow) with no card needed. |
| With modesty (hrī) | No hype, confetti only when a reward is actually earned. |
| With awe (bhī) | Confirm big actions (withdraw, end offer, cancel enrolment) with a modal that states the consequence. Merchants get a 24 h void window for refunds. |
| With sympathy (saṃvid) | Before joining, show: what you must do, by when, what you get, and the proof it's funded. |

Also: works on cheap phones (small JS bundle, PWA, no heavy maps by default), **Hindi and
English** from v1, a 6-digit code fallback when a camera isn't available, and a 2-tap
onboarding (phone → OTP).

*Test:* Could a 60-year-old in a small town finish onboarding in under two minutes, in
Hindi? This is checked in the E2E script (Hindi locale flow).

## Step 6 · Keep a quiet witness (Muṇḍaka 3.1.1)

- Every offer, enrolment and reward has a public `/proof/...` page. It shows the ledger
  entries, their hash chain, and (when a chain is configured) the live contract state read
  straight from the RPC, plus explorer links. It needs no login. Most users will never open
  it, and that's fine.
- `/proof` shows the whole public ledger (no PII) with a "verify hash chain" button that
  recomputes every hash in the browser.

**The honest limit:** the witness only records what it is shown. A fake purchase typed by a
merchant is recorded faithfully. Mitigations at the *moment of entry*:
- **Two-party presence:** a purchase can only be recorded against a customer's *live*
  presence code (rotates every 60 s, single customer, expires in 2 min). The merchant can't
  add progress for a customer who isn't there.
- Staff accounts are personal (per-phone), so every scan is attributable.
- Fraud flags: unusual scan velocity, high void rates (admin console).
- Merchant self-dealing (fake scans for friends) only spends the merchant's *own* escrow,
  so there is no protocol harm (PRD adversarial #2).

## Step 7 · Leave it full (Īśā 0–1)

- **Open source** (MIT): contracts, API, web app, docs.
- **Mā gṛdhaḥ, covet not:** the platform earns 2% **only when a customer actually redeems**.
  We make *nothing* from breakage (unredeemed or expired rewards return to the merchant), so
  our incentive matches the customer's. No yield is taken on escrow. No token.
- **Exit:** customers can download all their data (`/profile → Download my data`). Merchants
  can export customers and ledger as CSV. The contract is public, so anyone could run another
  front-end on it.

*Test:* If LoyalLink vanished tomorrow, the contract still holds every merchant's funds
and every customer's earned reward. A new operator could be granted the operator role by
the admin multisig, and all records remain readable from the chain and the exported ledger.

---

## After every release: Da, da, da (Bṛhadāraṇyaka 5.2.3)

Run this checklist before tagging a release (copied into `docs/10-TESTING.md`):

**Damyata (restrain)**
- [ ] Did we add an on-chain field? Justify it against R1–R5 or remove it.
- [ ] Did we start collecting a new piece of personal data? Justify it or remove it.
- [ ] Still no token?

**Datta (give)**
- [ ] Customer fees are still ₹0, and gas is still sponsored.
- [ ] Free tier is still usable for a single-shop merchant.
- [ ] Source and docs are published.

**Dayadhvam (be compassionate)**
- [ ] The banned-words test passes (no jargon in default UI).
- [ ] Every destructive action has a confirmation and, where possible, an undo window.
- [ ] Hindi strings are complete for customer flows.
- [ ] Tap targets ≥ 44 px, contrast AA (axe check in E2E).
