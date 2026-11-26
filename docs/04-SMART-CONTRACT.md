# 04 · Smart contract: `LoyaltyEscrow`

Solidity 0.8.28, OpenZeppelin 5 (`AccessControl`, `ReentrancyGuard`, `Pausable`, `SafeERC20`).
**Immutable**: no proxy, no upgrade. A new version means a new deployment, and merchants choose
whether to move (PRD §6.2 "Upgrade path").

ADR-01 (singleton vs per-merchant clones): the PRD proposes an EIP-1167 factory with one
instance per merchant. v1 uses **one immutable singleton with per-merchant ledgers**. It gives
the same "rules can't change under you" guarantee, a single solvency invariant to check, a single
token custody, and it makes future cross-merchant settlement an internal transfer instead of a
cross-contract call. Clones can return later if per-merchant isolation is needed for legal reasons.

## Roles
| Role | Holder (prod) | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Platform multisig | Role management, `setFeeBps` (≤ cap, future offers only), `withdrawFees` |
| `OPERATOR_ROLE` | Relayer hot key | All user-intent calls |
| `GUARDIAN_ROLE` | Security on-call | `pause` / `unpause` new activity |

## Constants & immutables
- `MAX_FEE_BPS = 300` (3%)
- `GRACE = 60 s`, `VOID_WINDOW = 24 h`, `MIN_REWARD_VALIDITY = 30 days`
- `token` (immutable), `maxBackdate` (immutable; 72 h in prod)

## State (per id = `bytes32`, derived from DB UUIDs)
```
Merchant  { exists, frozen, available, committed, owed }
Offer     { merchantId, kind, percentBps, feeBps, minPurchases, windowSecs, validitySecs,
            maxEnrolments, perCustomerLimit, enrolled, paused, ended,
            rewardValue, minTotalSpend, minPurchaseAmount, termsHash }
Enrolment { offerId, customerRef, deadline, purchases, spend, status, rewardId }
Purchase  { enrolmentId, amount, at, voided }
Reward    { merchantId, customerRef, enrolmentId, kind, percentBps, feeBps,
            value, remaining, expiresAt, issuedAt, status }
totalLiabilities, feesAccrued
```

## Functions (operator unless noted; every one emits an event)
| Function | Effect |
|---|---|
| `registerMerchant(m)` | create the ledger |
| `setMerchantFrozen(m, bool)` (admin/guardian) | frozen ⇒ no deposit, withdraw, publish or join. Completion, redemption and expiry still work |
| `deposit(m, amount)` | pull tokens from the operator ⇒ `available += amount` |
| `withdraw(m, amount)` | `available −= amount`, tokens → operator treasury (INR payout off-chain) |
| `createOffer(o, m, params, termsHash)` | validates params, snapshots `feeBps` |
| `setOfferPaused(o, bool)`, `endOffer(o)` | no new joins; existing joins unaffected (R4) |
| `enrol(e, o, customerRef, at)` | R1: `available ≥ value` ⇒ `available→committed` |
| `cancelEnrolment(e, at)` | `committed→available` |
| `expireEnrolment(e)` (**anyone**) | after `deadline + GRACE` ⇒ `committed→available` |
| `recordPurchase(p, e, amount, at, rewardId)` | progress; on completion issues `rewardId` (`committed→owed`), R3 |
| `voidPurchase(p, at)` | within `VOID_WINDOW`; may revoke an *unused* reward (`owed→committed`) |
| `redeem(r, rewardId, bill, at)` | computes use/discount; `owed −= value used`; merchant `available += use − fee`; `feesAccrued += fee` |
| `expireReward(rewardId)` (**anyone**) | after `expiresAt` ⇒ `owed→available` |
| `withdrawFees(to)` (admin) | fee collection |
| `pause()/unpause()` (guardian) | blocks `createOffer`, `enrol`, `deposit` only |

`at` must satisfy `block.timestamp − maxBackdate ≤ at ≤ block.timestamp`.

## Invariants (tested by a randomized sequence test in `test/LoyaltyEscrow.invariant.ts`)
1. `token.balanceOf(escrow) ≥ totalLiabilities`
2. `totalLiabilities == Σ(available + committed + owed) + feesAccrued`
3. `Σ committed(m) == Σ rewardValue of active enrolments of m`
4. `Σ owed(m) == Σ remaining of active rewards of m`
5. No call sequence lets `withdraw` reduce `committed` or `owed`.
6. A reward older than `VOID_WINDOW` (or already used) can never reach `revoked`.

## Errors
`NotFound`, `AlreadyExists`, `InvalidParams`, `InsufficientAvailable`, `OfferClosed`,
`CapReached`, `AlreadyEnrolled`, `CustomerLimit`, `NotActive`, `DeadlinePassed`,
`TooEarly`, `WindowClosed`, `BelowMinimum`, `Frozen`, `BadTimestamp`, `RewardUsed`.
The relayer treats `AlreadyExists` as success (idempotent replay).
