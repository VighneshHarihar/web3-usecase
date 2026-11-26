# 09 · Security, privacy and compliance

## Threat model (top items)
| Threat | Control |
|---|---|
| OTP brute force | 6 digits, 5-minute TTL, 5 attempts per code, 5 requests per phone per 15 min, IP rate limit, HMAC-hashed at rest |
| Session theft | Random 32-byte token, only its sha256 stored, httpOnly + Secure + SameSite=Lax cookie, 30-day expiry, logout revokes |
| CSRF | SameSite=Lax + `Origin` must match `APP_ORIGIN` on every non-GET |
| Merchant records fake progress for an absent customer | Purchases need a live counter session created from the customer's 2-minute presence code |
| Staff abuse | Per-person staff logins, every visit stores `staff_id`, admin velocity flags |
| Double-spend of a reward | `SELECT … FOR UPDATE` on the reward row + status check; contract re-checks |
| Withdrawing committed funds | API check + contract `InsufficientAvailable` |
| Payment spoofing | Razorpay signature (HMAC-SHA256 with the key secret) checked server-side, webhook secret, amount matched against our order. The sandbox provider is refused when `NODE_ENV=production` unless `ALLOW_SANDBOX_PAYMENTS=true` |
| Operator key compromise | Can't break R1–R5 (no such functions). Guardian can pause new activity. Keys are rotated through `AccessControl` |
| Contract bug | Two audits before mainnet (PRD), invariant tests, pause guardian, immutable code |
| Injection / XSS | Parameterised SQL (Drizzle), React escaping, helmet CSP |
| Enumeration of codes | Lookups need a merchant staff session + rate limit 30/min per staff |

## Privacy (DPDP Act 2023 / GDPR posture)
- **Minimum data:** phone (login), optional first name. No email, address, DOB or device fingerprint.
- **On chain:** never PII. Only `customerRef` (an HMAC, unlinkable without the server secret), ids and amounts.
- **Merchants see** first name + last 4 digits of the phone, never the full number.
- **Export:** `/api/me/export`. **Erasure:** `DELETE /api/me` scrubs phone and name
  (`phone = deleted:<uuid>`). Ledger entries contain no PII, so they stay intact.
- Logs redact `phone`, `code` and `cookie`.

## Compliance notes (from PRD §10 & §12, not legal advice)
- The settlement asset and the stored-value classification need counsel sign-off before mainnet
  (PPI rules, VDA/TDS). The v1 design keeps the customer away from any crypto instrument:
  customers only ever receive discounts on purchases.
- Merchant KYC: GSTIN/PAN format validation + manual admin review in v1. Vendor KYC (open-source
  alternatives are limited) is on the roadmap.
- Customer KYC threshold (₹50k/year of redemptions) is tracked as a metric in v1. No customer KYC
  flow yet.
