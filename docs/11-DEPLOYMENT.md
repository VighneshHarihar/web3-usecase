# 11 · Deployment

## Shape
One container (`Dockerfile`): the API bundled into self-contained JS files plus the built web app,
served by the API. It needs **PostgreSQL 16** and, for on-chain escrow, an **EVM RPC**. Migrations
run automatically on boot. Background workers run in-process and elect one leader with a Postgres
advisory lock, so you can run several replicas safely.

## Environments

| | Dev | Testnet / staging | Production |
|---|---|---|---|
| Chain | `CHAIN_MODE=local` + `pnpm chain` (auto-deploys and replays the ledger) | `CHAIN_MODE=rpc`, Base Sepolia (84532) | `CHAIN_MODE=rpc`, Base (8453) or Polygon |
| Settlement token | TestRupee (auto) | TestRupee via `deploy-cli` | Counsel-approved asset (ADR-03) |
| Payments | `sandbox` | `razorpay` test keys | `razorpay` live keys |
| SMS | `console` + `OTP_DEV_ECHO=true` | `webhook` | `webhook` |

## Deploy the contract (testnet)

```bash
cd apps/api
RPC_URL=https://sepolia.base.org CHAIN_ID=84532 CHAIN_NAME="Base Sepolia" \
OPERATOR_PRIVATE_KEY=0x…relayer-key… \
ADMIN_ADDRESS=0x…multisig… GUARDIAN_ADDRESS=0x…oncall… \
pnpm exec tsx src/chain/deploy-cli.ts
# → prints ESCROW_ADDRESS=… TOKEN_ADDRESS=…
```

The relayer key needs `OPERATOR_ROLE` (granted at deploy). To mirror shop freezes, also grant it
`GUARDIAN_ROLE` from the admin multisig, or leave freezes to the guardian. Fund the relayer with
ETH for gas. In `rpc` mode the treasury (the relayer address) must hold the settlement token for
deposits: mint TestRupee on testnet, buy the real asset in production.

## Environment variables
See `.env.example`. In production the app **refuses to start** unless `SESSION_SECRET` and
`CUSTOMER_REF_SECRET` are set, `OTP_DEV_ECHO` is off, sandbox payments are off (or explicitly
`ALLOW_SANDBOX_PAYMENTS=true` for a demo), and `OPERATOR_PRIVATE_KEY` is not the public test key.

⚠️ `CUSTOMER_REF_SECRET` must never change after launch: it derives every customer's on-chain id.

## Razorpay
1. Set `PAYMENTS_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. Add a webhook to `https://<host>/api/webhooks/razorpay` for `payment.captured` and
   `payment.failed` with `RAZORPAY_WEBHOOK_SECRET`. It is the backup path if the browser closes
   before confirming.
3. Payouts (merchant withdrawals) are a manual queue in v1: ops pays via UPI/bank and records the
   UTR in **Admin → Payouts**. RazorpayX automation is on the roadmap.

## SMS
`SMS_PROVIDER=webhook` POSTs `{ "to": "+91…", "text": "…" }` with `Authorization: Bearer
$SMS_WEBHOOK_TOKEN` to `SMS_WEBHOOK_URL`. Put a tiny relay in front of MSG91, Gupshup or Twilio
(DLT templates in India).

## Production checklist (mainnet gate)
- [ ] Two independent audits of `LoyaltyEscrow.sol` + bug bounty
- [ ] Admin role on a multisig; guardian on an on-call key; relayer key in a KMS/HSM
- [ ] Legal sign-off on the settlement asset (PPI / VDA / TDS)
- [ ] `maxBackdate` = 72 h at deploy
- [ ] Postgres backups + PITR; TLS in front of the app (`trustProxy` is on)
- [ ] Alerts: `/api/health`, admin overview `ledger.failed > 0`, `invariantMismatches` non-empty, relayer lag
- [ ] Release checklist "Da, da, da" in `10-TESTING.md`

## Not verified in this build environment
The Docker image and compose file were written but could not be built here (no Docker daemon).
The same bundle was run directly with Node (`node apps/api/dist/server.js`) and served the app and
API correctly.
