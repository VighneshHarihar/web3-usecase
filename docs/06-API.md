# 06 · HTTP API

Base `/api`. JSON in and out. Auth is the httpOnly cookie `ll_session`. Mutating requests must
come from the app origin (`Origin` check). Errors look like
`{ "error": { "code": "INSUFFICIENT_POOL", "message": "…" } }`.

## Public
| Method | Path | |
|---|---|---|
| GET | `/health` | db + chain status |
| GET | `/config` | public config (payments provider + key id, chain info, features) |
| POST | `/auth/otp/request` | `{phone}` → `{ok, devCode?}` (devCode only if `OTP_DEV_ECHO=true`) |
| POST | `/auth/otp/verify` | `{phone, code}` → sets cookie, `{user, isNew}` |
| POST | `/auth/logout` | |
| GET | `/offers?lat&lng&category&q` | live offers with shop, distance, spots, `secured` |
| GET | `/offers/:id` | detail + `mine` (if logged in) |
| GET | `/shops/:slug` | shop + live offers |
| GET | `/proof/ledger?after&limit` | public ledger page |
| GET | `/proof/:kind/:id` | kind ∈ offer, enrolment, reward, merchant → events + on-chain view |

## Me / customer (`/me`, `/c`)
| GET | `/me` | user + memberships |
| PATCH | `/me` | `{name?, locale?}` |
| GET | `/me/export` | full JSON data export |
| DELETE | `/me` | anonymise account |
| GET | `/c/home` | enrolments, rewards, unread count |
| POST | `/c/offers/:id/join` | → enrolment, or `409 POOL_FULL` |
| POST | `/c/offers/:id/waitlist` | |
| GET | `/c/enrolments/:id` | progress + purchases |
| POST | `/c/enrolments/:id/cancel` | |
| GET | `/c/rewards` | |
| GET | `/c/activity` | |
| POST | `/c/presence` | → `{code, qr, expiresAt}` |
| GET | `/c/presence/:code/status` | was it scanned? latest counter result (for live UI) |
| GET | `/c/notifications` · POST `/c/notifications/read` | |

## Merchant (`/merchants`, `/m/:mid`), membership required
| POST | `/merchants` | onboarding → pending shop, caller = owner |
| GET/PATCH | `/m/:mid` | profile, balances, plan |
| GET | `/m/:mid/dashboard` | KPIs, funnel, activity |
| GET/POST | `/m/:mid/offers` | list / create draft |
| GET/PATCH | `/m/:mid/offers/:oid` | detail / edit (draft: everything; live: title + description) |
| POST | `/m/:mid/offers/:oid/{publish,pause,resume,end}` | |
| GET | `/m/:mid/offers/:oid/enrolments` | anonymised |
| GET | `/m/:mid/pool` | balances + movements |
| POST | `/m/:mid/pool/topup` | `{amount}` → payment |
| POST | `/m/:mid/pool/withdraw` | `{amount}` → payout |
| POST | `/m/:mid/counter/lookup` | `{code}` (6-digit or QR payload) → counter session + customer card |
| POST | `/m/:mid/counter/purchase` | `{sessionId, amount}` → progress, completions |
| POST | `/m/:mid/counter/redeem` | `{sessionId, rewardId, billAmount}` |
| POST | `/m/:mid/counter/visits/:vid/void` | |
| GET | `/m/:mid/counter/recent` | |
| GET | `/m/:mid/customers` (`?format=csv` Pro) | |
| GET/POST/DELETE | `/m/:mid/members` | team (Pro) |
| POST | `/m/:mid/plan/upgrade` | → payment |

## Payments
| GET | `/payments/:id` | |
| POST | `/payments/:id/confirm` | Razorpay: `{razorpay_payment_id, razorpay_order_id, razorpay_signature}`. Sandbox: `{simulate:"success"\|"failure"}` |
| POST | `/webhooks/razorpay` | HMAC-verified |

## Admin (`is_admin`)
| GET | `/admin/overview` | stats, ledger lag/failed, invariant check |
| GET | `/admin/merchants?status=` | |
| POST | `/admin/merchants/:id/{approve,reject,freeze,unfreeze}` | |
| GET | `/admin/payouts` · POST `/admin/payouts/:id/paid` `{reference}` | |
| GET | `/admin/ledger?status=` · POST `/admin/ledger/:seq/retry` | |
| GET | `/admin/flags` | fraud heuristics |
