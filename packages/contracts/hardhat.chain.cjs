// Minimal config used by docker-compose's `chain` service (a plain dev node, no compilation).
module.exports = { solidity: '0.8.28', networks: { hardhat: { chainId: 31337 } } };
