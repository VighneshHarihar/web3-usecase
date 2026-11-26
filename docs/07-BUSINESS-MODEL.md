# 07 · Business model

Guided by Īśā 1, *mā gṛdhaḥ* ("covet not"): **charge fairly for real service, and earn only
when the customer gets value.**

## 1. Who pays what

| | Customer | Merchant | Platform earns |
|---|---|---|---|
| Sign-up, joining offers, network fees | ₹0 | ₹0 | n/a |
| Funding the reward pool (UPI) | n/a | ₹0 platform fee (gateway cost absorbed on Free and Pro) | n/a |
| Withdrawing unused pool | n/a | ₹0 | n/a |
| **Redemption** | ₹0 | **2% of the reward value actually used**, deducted from the reimbursement | 2% |
| Unredeemed or expired reward | n/a | money returns to the merchant | **₹0. We never earn from breakage** |
| Pro plan | n/a | ₹999 per 30 days | ₹999 |

The fee is snapshotted per offer and **hard-capped at 3% in the contract**, so the
platform cannot raise it on existing offers or beyond the cap.

### Plans
| | Free | Pro (₹999 / 30 days) |
|---|---|---|
| Live offers | 1 | Unlimited |
| Pool balance (available + committed) | up to ₹10,000 | Unlimited |
| Staff logins | Owner only | Up to 10 |
| Dashboard | KPIs + funnel | + customer list CSV export, + ledger CSV |
| Support | Community | Priority |

Downgrade is never destructive. Live offers keep running, but new publishes and top-ups
respect Free limits.

## 2. Why the incentives line up
- Customers get a guaranteed reward, so they come back. That's the merchant's goal.
- The merchant pays only for completed loyalty (the reservation returns if the customer
  doesn't finish), so their cost tracks real repeat revenue.
- The platform is paid on *redemption*, so we are pushed to make rewards easy to use (the
  opposite of a breakage business model: PRD §2 "Expiry abuse").

## 3. Unit economics (per merchant per month, Pune high-street baseline)

Assumptions: 120 joins / month, 45% completion, average reward cost ₹250, 90% of earned
rewards redeemed, average 5 on-chain txs per enrolment (enrol, 3 purchases, redeem), gas
on Base ≈ ₹0.40/tx, SMS OTP ₹0.20, average 1.3 logins per customer per month.

| Line | Free merchant | Pro merchant |
|---|---|---|
| Rewards redeemed: 120 × 0.45 × 0.9 × ₹250 | ₹12,150 | ₹12,150 |
| Redemption fee 2% | ₹243 | ₹243 |
| Subscription | n/a | ₹999 |
| **Revenue** | **₹243** | **₹1,242** |
| Gas: 120 × 5 × ₹0.40 | −₹240 | −₹240 |
| OTP SMS: 120 × 1.3 × ₹0.20 | −₹31 | −₹31 |
| Payment gateway on top-ups (~2% of ₹15k) | −₹300 | −₹300 |
| Hosting share | −₹20 | −₹20 |
| **Contribution** | **≈ −₹350** | **≈ +₹650** |

Reading: **Free is a deliberate acquisition cost** (śrī, giving in plenty), recovered when a
merchant upgrades. Break-even happens at about **1 Pro merchant per 2 Free merchants**. Levers we
expect: UPI top-ups at 0% MDR (UPI P2M is zero-MDR in India today for most merchants), gas
batching (`multicall`, roadmap) cutting gas ~60%, and WhatsApp-OTP pricing.

For the merchant: a ₹250 reward on ₹1,570 of tracked repeat spend (worked example in
`02-PRODUCT-SPEC-v1.md`) is a **~9% loyalty cost**. That compares with 18–30% aggregator
commissions and ₹4k–40k/month for loyalty SaaS (PRD §6.3).

## 4. Go-to-market (from the PRD, unchanged)
Merchants are the distribution: every shop gets a printable poster (`/m/:mid/poster`) whose
QR opens the shop page. No paid customer acquisition. Start with one dense cluster (2–3 km).

## 5. What we will not do
- Sell customer data or show ads inside the customer app.
- Take yield on escrowed funds.
- Launch a token.
- Charge customers.
