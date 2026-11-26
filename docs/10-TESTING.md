# 10 · Testing strategy

| Layer | Tool | Command | What |
|---|---|---|---|
| Shared rules | Vitest | `pnpm --filter @loyallink/shared test` | Offer engine: progress, completion, discount, fee math, plain-language text, banned-words check |
| Contract | Hardhat + mocha + viem | `pnpm --filter @loyallink/contracts test` | Lifecycle, every revert, randomized invariant run |
| API | Vitest + real Postgres | `pnpm --filter @loyallink/api test` | Auth, onboarding → approval, offer publish limits, join/pool-full/waitlist, counter purchase → completion, redeem, void, expiry sweeps, hash chain, chain relayer against a Hardhat node |
| End-to-end | Playwright (Chromium) | `pnpm e2e` | Full story: merchant onboards → admin approves → funds pool → publishes offer → customer (Hindi) joins → 3 counter scans → reward → redeem → proof page |

## PRD §10 coverage
| PRD case | Test |
|---|---|
| Happy 1: merchant signup → offer live | api `flow.test.ts`, e2e |
| Happy 2: join → complete → redeem | api `flow.test.ts`, contract, e2e |
| Happy 4: failed offer → escrow released | api `sweeper.test.ts`, contract |
| Edge 1: pool runs out → waitlist | api `flow.test.ts` |
| Edge 2: withdraw committed rejected | api `flow.test.ts`, contract |
| Edge 3: change terms with active customers | api `flow.test.ts` (numeric edit on live offer → 409) |
| Edge 7: refund / void window | api `flow.test.ts`, contract |
| Edge 11: pause offer | api + contract |
| Edge 13: last-second purchase (grace) | rules unit + contract |
| Edge 14: double redemption | api (parallel redeem → exactly one succeeds) |
| Security: reentrancy | contract (nonReentrant + SafeERC20, no external calls before state) |
| Invariant: solvency | contract randomized run, api admin invariant check |
| DB ⇄ chain divergence | api `zz-chain.test.ts` replays the whole ledger onto Hardhat and compares every merchant balance |

## Release checklist (Da, da, da, from 01-PRINCIPLES.md)
- [ ] All four suites green
- [ ] Damyata: no new on-chain field or PII without a justification in the PR
- [ ] Datta: customer fees ₹0, Free tier usable
- [ ] Dayadhvam: banned-words test green, Hindi strings complete, confirmations on destructive actions
