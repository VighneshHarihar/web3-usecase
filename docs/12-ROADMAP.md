# 12 · Roadmap

| Version | Theme | Items |
|---|---|---|
| **v1.0** (this release) | Single-shop guaranteed loyalty | Everything in `02-PRODUCT-SPEC-v1.md` §1 "Must" |
| v1.1 | Reach | Web-push notifications (VAPID, open-source `web-push`), WhatsApp OTP adapter, Marathi/Tamil/Kannada, offer images, Leaflet/OSM map view |
| v1.2 | Network | **Cross-merchant redemption** (partner lists, internal transfer in the singleton escrow, network spread ≤ 5% split with an insurance pool), merchant referral rewards |
| v1.3 | Self-custody | Merchant EIP-712 attestations from a passkey smart account (ERC-4337 via `permissionless`), customer optional self-custody export |
| v2.0 | Scale | Multicall batching in the relayer, subgraph indexer, POS integrations (Petpooja, PineLabs), chains with many outlets, tiered rewards, blackout windows, KYC vendor adapter, USDC settlement with FX layer |
| v3.0 | Protocol | Public API keys, third-party front-ends, governance (no token unless it does real work) |

Mainnet gate: two independent audits, a bug bounty, legal sign-off on the settlement asset,
and the admin role on a multisig.
