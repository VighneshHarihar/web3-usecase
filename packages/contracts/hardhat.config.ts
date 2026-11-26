import { subtask, type HardhatUserConfig } from 'hardhat/config';
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from 'hardhat/builtin-tasks/task-names';
import '@nomicfoundation/hardhat-viem';

// Use the solc-js compiler shipped in the `solc` npm package so builds work offline
// (binaries.soliditylang.org is not reachable from every CI). See docs/08-TECH-STACK.md ADR-02.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: { solcVersion: string }) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const solc = require('solc');
  return { compilerPath: require.resolve('solc/soljson.js'), isSolcJs: true, version: args.solcVersion, longVersion: solc.version() };
});

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', viaIR: false },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: 'http://127.0.0.1:8545', chainId: 31337 },
  },
  mocha: { timeout: 120_000 },
};
export default config;
