// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LoyaltyEscrow
 * @notice Pre-funded loyalty rewards for neighbourhood shops. Immutable: no proxy, no upgrade.
 *
 * The rules that must never bend (docs/01-PRINCIPLES.md):
 *  R1 Funded before promised: joining moves the reward from `available` to `committed`.
 *  R2 Committed money is untouchable: merchants can withdraw only `available`.
 *  R3 Earned is owned: completion issues the reward automatically; after VOID_WINDOW it can't be revoked.
 *  R4 Terms are frozen at enrolment: offers have no edit function.
 *  R5 The platform's take is capped: fee snapshotted per offer, <= MAX_FEE_BPS.
 *
 * Every rule here mirrors packages/shared/src/rules.ts.
 */
contract LoyaltyEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    uint16 public constant MAX_FEE_BPS = 300;
    uint64 public constant GRACE = 60;
    uint64 public constant VOID_WINDOW = 24 hours;
    uint64 public constant MIN_REWARD_VALIDITY = 30 days;
    uint64 public constant MAX_PERIOD = 365 days;

    IERC20 public immutable token;
    uint64 public immutable maxBackdate;
    uint16 public feeBps;

    enum Kind { None, Credit, Percent }
    enum EStatus { None, Active, Completed, Expired, Cancelled }
    enum RStatus { None, Active, Used, Expired, Revoked }

    struct Merchant {
        bool exists;
        bool frozen;
        uint128 available;
        uint128 committed;
        uint128 owed;
    }

    struct OfferParams {
        Kind kind;
        uint16 percentBps;
        uint32 minPurchases;
        uint32 windowSecs;
        uint32 validitySecs;
        uint32 maxEnrolments;
        uint32 perCustomerLimit;
        uint128 rewardValue;
        uint128 minTotalSpend;
        uint128 minPurchaseAmount;
        bytes32 termsHash;
    }

    struct Offer {
        bytes32 merchantId;
        OfferParams p;
        uint16 feeBps;
        uint32 enrolled; // active + completed
        bool paused;
        bool ended;
    }

    struct Enrolment {
        bytes32 offerId;
        bytes32 customerRef;
        uint64 deadline;
        uint32 purchases;
        EStatus status;
        uint128 spend;
        bytes32 rewardId;
    }

    struct Purchase {
        bytes32 enrolmentId;
        uint128 amount;
        uint64 at;
        bool voided;
    }

    struct Reward {
        bytes32 merchantId;
        bytes32 customerRef;
        bytes32 enrolmentId;
        Kind kind;
        uint16 percentBps;
        uint16 feeBps;
        RStatus status;
        uint64 issuedAt;
        uint64 expiresAt;
        uint128 value;
        uint128 remaining;
    }

    mapping(bytes32 => Merchant) public merchants;
    mapping(bytes32 => Offer) internal _offers;
    mapping(bytes32 => Enrolment) public enrolments;
    mapping(bytes32 => Purchase) public purchases;
    mapping(bytes32 => Reward) public rewards;
    mapping(bytes32 => bool) public redemptionUsed;
    /// offer => customerRef => completed enrolments
    mapping(bytes32 => mapping(bytes32 => uint32)) public completions;
    /// offer => customerRef => active enrolment id
    mapping(bytes32 => mapping(bytes32 => bytes32)) public activeEnrolmentOf;

    /// Sum of every merchant's available + committed + owed, plus feesAccrued.
    uint256 public totalLiabilities;
    uint256 public feesAccrued;

    // ── errors ────────────────────────────────────────────────────────────
    error NotFound();
    error AlreadyExists();
    error InvalidParams();
    error InsufficientAvailable();
    error OfferClosed();
    error CapReached();
    error AlreadyEnrolled();
    error CustomerLimit();
    error NotActive();
    error DeadlinePassed();
    error TooEarly();
    error WindowClosed();
    error BelowMinimum();
    error Frozen();
    error BadTimestamp();
    error RewardUsed();
    error Unauthorized();

    // ── events ────────────────────────────────────────────────────────────
    event MerchantRegistered(bytes32 indexed merchantId);
    event MerchantFrozen(bytes32 indexed merchantId, bool frozen);
    event Deposited(bytes32 indexed merchantId, uint256 amount);
    event Withdrawn(bytes32 indexed merchantId, uint256 amount);
    event OfferCreated(bytes32 indexed offerId, bytes32 indexed merchantId, bytes32 termsHash, uint16 feeBps);
    event OfferPaused(bytes32 indexed offerId, bool paused);
    event OfferEnded(bytes32 indexed offerId);
    event Enrolled(bytes32 indexed enrolmentId, bytes32 indexed offerId, bytes32 indexed customerRef, uint128 reserved, uint64 deadline);
    event EnrolmentClosed(bytes32 indexed enrolmentId, EStatus status);
    event PurchaseRecorded(bytes32 indexed purchaseId, bytes32 indexed enrolmentId, uint128 amount, uint32 purchases, uint128 spend);
    event PurchaseVoided(bytes32 indexed purchaseId, bytes32 indexed enrolmentId);
    event RewardIssued(bytes32 indexed rewardId, bytes32 indexed enrolmentId, bytes32 indexed customerRef, uint128 value, uint64 expiresAt);
    event RewardRevoked(bytes32 indexed rewardId);
    event Redeemed(bytes32 indexed redemptionId, bytes32 indexed rewardId, uint128 bill, uint128 used, uint128 fee, uint128 returned);
    event RewardExpired(bytes32 indexed rewardId, uint128 returned);
    event FeeBpsChanged(uint16 feeBps);
    event FeesWithdrawn(address to, uint256 amount);

    constructor(IERC20 token_, address admin, address operator, address guardian, uint16 feeBps_, uint64 maxBackdate_) {
        if (address(token_) == address(0) || admin == address(0) || feeBps_ > MAX_FEE_BPS) revert InvalidParams();
        token = token_;
        feeBps = feeBps_;
        maxBackdate = maxBackdate_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (operator != address(0)) _grantRole(OPERATOR_ROLE, operator);
        if (guardian != address(0)) _grantRole(GUARDIAN_ROLE, guardian);
    }

    // ── internal helpers ──────────────────────────────────────────────────
    function _checkAt(uint64 at) internal view {
        if (at > block.timestamp || uint256(at) + maxBackdate < block.timestamp) revert BadTimestamp();
    }

    function _merchant(bytes32 m) internal view returns (Merchant storage mm) {
        mm = merchants[m];
        if (!mm.exists) revert NotFound();
    }

    function _bps(uint128 amount, uint16 bps) internal pure returns (uint128) {
        return uint128((uint256(amount) * bps) / 10_000);
    }

    function _release(Enrolment storage en, EStatus status, bytes32 enrolmentId) internal {
        Offer storage o = _offers[en.offerId];
        Merchant storage mm = merchants[o.merchantId];
        uint128 v = o.p.rewardValue;
        mm.committed -= v;
        mm.available += v;
        en.status = status;
        o.enrolled -= 1;
        delete activeEnrolmentOf[en.offerId][en.customerRef];
        emit EnrolmentClosed(enrolmentId, status);
    }

    // ── merchants & pool ──────────────────────────────────────────────────
    function registerMerchant(bytes32 m) external onlyRole(OPERATOR_ROLE) {
        if (m == bytes32(0)) revert InvalidParams();
        if (merchants[m].exists) revert AlreadyExists();
        merchants[m].exists = true;
        emit MerchantRegistered(m);
    }

    function setMerchantFrozen(bytes32 m, bool frozen) external {
        if (!hasRole(GUARDIAN_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) revert Unauthorized();
        _merchant(m).frozen = frozen;
        emit MerchantFrozen(m, frozen);
    }

    function deposit(bytes32 m, uint128 amount) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        Merchant storage mm = _merchant(m);
        if (mm.frozen) revert Frozen();
        if (amount == 0) revert InvalidParams();
        mm.available += amount;
        totalLiabilities += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(m, amount);
    }

    /// R2: only `available` can leave. Funds go to the operator treasury, which pays out INR off-chain.
    function withdraw(bytes32 m, uint128 amount) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Merchant storage mm = _merchant(m);
        if (mm.frozen) revert Frozen();
        if (amount == 0) revert InvalidParams();
        if (mm.available < amount) revert InsufficientAvailable();
        mm.available -= amount;
        totalLiabilities -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(m, amount);
    }

    // ── offers ────────────────────────────────────────────────────────────
    function createOffer(bytes32 o, bytes32 m, OfferParams calldata p) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (o == bytes32(0)) revert InvalidParams();
        if (_offers[o].merchantId != bytes32(0)) revert AlreadyExists();
        Merchant storage mm = _merchant(m);
        if (mm.frozen) revert Frozen();
        bool kindOk = (p.kind == Kind.Credit && p.percentBps == 0) ||
            (p.kind == Kind.Percent && p.percentBps >= 1 && p.percentBps <= 10_000);
        if (
            !kindOk || p.minPurchases == 0 || p.windowSecs < 1 days || p.windowSecs > MAX_PERIOD ||
            p.validitySecs < MIN_REWARD_VALIDITY || p.validitySecs > MAX_PERIOD || p.rewardValue == 0 ||
            p.maxEnrolments == 0 || p.perCustomerLimit == 0
        ) revert InvalidParams();
        Offer storage off = _offers[o];
        off.merchantId = m;
        off.p = p;
        off.feeBps = feeBps; // R5 snapshot
        emit OfferCreated(o, m, p.termsHash, feeBps);
    }

    function setOfferPaused(bytes32 o, bool paused_) external onlyRole(OPERATOR_ROLE) {
        Offer storage off = _offers[o];
        if (off.merchantId == bytes32(0)) revert NotFound();
        if (off.ended) revert OfferClosed();
        off.paused = paused_;
        emit OfferPaused(o, paused_);
    }

    function endOffer(bytes32 o) external onlyRole(OPERATOR_ROLE) {
        Offer storage off = _offers[o];
        if (off.merchantId == bytes32(0)) revert NotFound();
        off.ended = true;
        emit OfferEnded(o);
    }

    function offers(bytes32 o) external view returns (Offer memory) {
        return _offers[o];
    }

    // ── enrolments ────────────────────────────────────────────────────────
    /// R1: a customer can only join if the reward is funded right now.
    function enrol(bytes32 e, bytes32 o, bytes32 customerRef, uint64 at) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        _checkAt(at);
        if (e == bytes32(0) || customerRef == bytes32(0)) revert InvalidParams();
        if (enrolments[e].status != EStatus.None) revert AlreadyExists();
        Offer storage off = _offers[o];
        if (off.merchantId == bytes32(0)) revert NotFound();
        if (off.paused || off.ended) revert OfferClosed();
        Merchant storage mm = merchants[off.merchantId];
        if (mm.frozen) revert Frozen();
        if (off.enrolled >= off.p.maxEnrolments) revert CapReached();
        if (activeEnrolmentOf[o][customerRef] != bytes32(0)) revert AlreadyEnrolled();
        if (completions[o][customerRef] >= off.p.perCustomerLimit) revert CustomerLimit();
        uint128 v = off.p.rewardValue;
        if (mm.available < v) revert InsufficientAvailable();

        mm.available -= v;
        mm.committed += v;
        off.enrolled += 1;
        activeEnrolmentOf[o][customerRef] = e;
        uint64 deadline = at + off.p.windowSecs;
        enrolments[e] = Enrolment(o, customerRef, deadline, 0, EStatus.Active, 0, bytes32(0));
        emit Enrolled(e, o, customerRef, v, deadline);
    }

    function cancelEnrolment(bytes32 e, uint64 at) external onlyRole(OPERATOR_ROLE) {
        _checkAt(at);
        Enrolment storage en = enrolments[e];
        if (en.status != EStatus.Active) revert NotActive();
        _release(en, EStatus.Cancelled, e);
    }

    /// Anyone may expire an enrolment once its window (plus grace) has passed.
    function expireEnrolment(bytes32 e) external {
        Enrolment storage en = enrolments[e];
        if (en.status != EStatus.Active) revert NotActive();
        if (block.timestamp <= uint256(en.deadline) + GRACE) revert TooEarly();
        _release(en, EStatus.Expired, e);
    }

    // ── purchases ─────────────────────────────────────────────────────────
    /// R3: completion issues the reward in the same call; nobody approves it.
    function recordPurchase(bytes32 p, bytes32 e, uint128 amount, uint64 at, bytes32 rewardId) external onlyRole(OPERATOR_ROLE) {
        _checkAt(at);
        if (p == bytes32(0)) revert InvalidParams();
        if (purchases[p].enrolmentId != bytes32(0)) revert AlreadyExists();
        Enrolment storage en = enrolments[e];
        if (en.status != EStatus.Active) revert NotActive();
        if (uint256(at) > uint256(en.deadline) + GRACE) revert DeadlinePassed();
        Offer storage off = _offers[en.offerId];
        if (amount == 0 || amount < off.p.minPurchaseAmount) revert BelowMinimum();

        purchases[p] = Purchase(e, amount, at, false);
        en.purchases += 1;
        en.spend += amount;
        emit PurchaseRecorded(p, e, amount, en.purchases, en.spend);

        if (en.purchases >= off.p.minPurchases && en.spend >= off.p.minTotalSpend) {
            if (rewardId == bytes32(0)) revert InvalidParams();
            if (rewards[rewardId].status != RStatus.None) revert AlreadyExists();
            Merchant storage mm = merchants[off.merchantId];
            uint128 v = off.p.rewardValue;
            mm.committed -= v;
            mm.owed += v;
            uint64 expiresAt = at + off.p.validitySecs;
            rewards[rewardId] = Reward(
                off.merchantId, en.customerRef, e, off.p.kind, off.p.percentBps, off.feeBps,
                RStatus.Active, at, expiresAt, v, v
            );
            en.status = EStatus.Completed;
            en.rewardId = rewardId;
            completions[en.offerId][en.customerRef] += 1;
            delete activeEnrolmentOf[en.offerId][en.customerRef];
            emit EnrolmentClosed(e, EStatus.Completed);
            emit RewardIssued(rewardId, e, en.customerRef, v, expiresAt);
        }
    }

    /// Refunds: within VOID_WINDOW of the purchase. Never revokes a reward that has been used.
    function voidPurchase(bytes32 p, uint64 at) external onlyRole(OPERATOR_ROLE) {
        _checkAt(at);
        Purchase storage pu = purchases[p];
        if (pu.enrolmentId == bytes32(0)) revert NotFound();
        if (pu.voided) revert AlreadyExists();
        if (uint256(at) > uint256(pu.at) + VOID_WINDOW) revert WindowClosed();
        bytes32 e = pu.enrolmentId;
        Enrolment storage en = enrolments[e];
        Offer storage off = _offers[en.offerId];

        if (en.status == EStatus.Completed) {
            Reward storage r = rewards[en.rewardId];
            if (r.status != RStatus.Active || r.remaining != r.value) revert RewardUsed();
            pu.voided = true;
            en.purchases -= 1;
            en.spend -= pu.amount;
            if (!(en.purchases >= off.p.minPurchases && en.spend >= off.p.minTotalSpend)) {
                Merchant storage mm = merchants[off.merchantId];
                uint128 v = r.value;
                bytes32 rid = en.rewardId;
                r.status = RStatus.Revoked;
                r.remaining = 0;
                mm.owed -= v;
                completions[en.offerId][en.customerRef] -= 1;
                en.rewardId = bytes32(0);
                emit RewardRevoked(rid);
                bool slotTaken = activeEnrolmentOf[en.offerId][en.customerRef] != bytes32(0);
                if (slotTaken || uint256(at) > uint256(en.deadline) + GRACE) {
                    // Can't go back to active: the reservation returns to the merchant.
                    mm.available += v;
                    en.status = EStatus.Expired;
                    off.enrolled -= 1;
                    emit EnrolmentClosed(e, EStatus.Expired);
                } else {
                    mm.committed += v;
                    en.status = EStatus.Active;
                    activeEnrolmentOf[en.offerId][en.customerRef] = e;
                }
            }
        } else {
            pu.voided = true;
            en.purchases -= 1;
            en.spend -= pu.amount;
        }
        emit PurchaseVoided(p, e);
    }

    // ── rewards ───────────────────────────────────────────────────────────
    function redeem(bytes32 rd, bytes32 rewardId, uint128 bill, uint64 at) external onlyRole(OPERATOR_ROLE) nonReentrant {
        _checkAt(at);
        if (rd == bytes32(0) || bill == 0) revert InvalidParams();
        if (redemptionUsed[rd]) revert AlreadyExists();
        Reward storage r = rewards[rewardId];
        if (r.status != RStatus.Active) revert NotActive();
        if (at > r.expiresAt) revert WindowClosed();

        uint128 before = r.remaining;
        uint128 used;
        uint128 returned;
        if (r.kind == Kind.Credit) {
            used = before < bill ? before : bill;
            r.remaining = before - used;
        } else {
            uint128 d = _bps(bill, r.percentBps);
            used = d < before ? d : before;
            returned = before - used;
            r.remaining = 0;
        }
        uint128 fee = _bps(used, r.feeBps);
        if (r.remaining == 0) r.status = RStatus.Used;
        redemptionUsed[rd] = true;

        Merchant storage mm = merchants[r.merchantId];
        mm.owed -= (used + returned);
        mm.available += (used - fee) + returned;
        feesAccrued += fee;
        emit Redeemed(rd, rewardId, bill, used, fee, returned);
    }

    /// Anyone may expire a reward after its validity; the remaining value returns to the merchant.
    function expireReward(bytes32 rewardId) external {
        Reward storage r = rewards[rewardId];
        if (r.status != RStatus.Active) revert NotActive();
        if (block.timestamp <= r.expiresAt) revert TooEarly();
        uint128 rem = r.remaining;
        Merchant storage mm = merchants[r.merchantId];
        mm.owed -= rem;
        mm.available += rem;
        r.status = RStatus.Expired;
        emit RewardExpired(rewardId, rem);
    }

    // ── admin / guardian ──────────────────────────────────────────────────
    function setFeeBps(uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bps > MAX_FEE_BPS) revert InvalidParams();
        feeBps = bps;
        emit FeeBpsChanged(bps);
    }

    function withdrawFees(address to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        uint256 amount = feesAccrued;
        feesAccrued = 0;
        totalLiabilities -= amount;
        token.safeTransfer(to, amount);
        emit FeesWithdrawn(to, amount);
    }

    /// The guardian can stop *new* activity only. It cannot move funds or block customers' rights.
    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    function solvent() external view returns (bool) {
        return token.balanceOf(address(this)) >= totalLiabilities;
    }
}
