/**
 * Deploy LoyaltyEscrow (and TestRupee if TOKEN_ADDRESS is unset) to the chain at RPC_URL.
 *   ADMIN_ADDRESS=0x… GUARDIAN_ADDRESS=0x… pnpm --filter @loyallink/api exec tsx src/chain/deploy-cli.ts
 * Prints ESCROW_ADDRESS / TOKEN_ADDRESS for your .env.
 */
import { LoyaltyEscrowAbi, LoyaltyEscrowBytecode, TestRupeeAbi, TestRupeeBytecode } from '@loyallink/contracts/abi';
import { createPublicClient, createWalletClient, defineChain, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config.js';

async function main() {
  const chain = defineChain({ id: config.CHAIN_ID, name: config.CHAIN_NAME, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [config.RPC_URL] } } });
  const account = privateKeyToAccount(config.OPERATOR_PRIVATE_KEY as Hex);
  const pc = createPublicClient({ chain, transport: http() });
  const wc = createWalletClient({ chain, account, transport: http() });
  const admin = (process.env.ADMIN_ADDRESS ?? account.address) as Address;
  const guardian = (process.env.GUARDIAN_ADDRESS ?? account.address) as Address;
  const maxBackdate = BigInt(process.env.MAX_BACKDATE_SECONDS ?? 72 * 3600);
  let token = config.TOKEN_ADDRESS as Address | undefined;
  if (!token) {
    const h = await wc.deployContract({ abi: TestRupeeAbi, bytecode: TestRupeeBytecode, args: [account.address] });
    token = (await pc.waitForTransactionReceipt({ hash: h })).contractAddress!;
    console.log('TestRupee deployed (TEST ONLY):', token);
  }
  const h = await wc.deployContract({ abi: LoyaltyEscrowAbi, bytecode: LoyaltyEscrowBytecode, args: [token, admin, account.address, guardian, config.FEE_BPS, maxBackdate] });
  const escrow = (await pc.waitForTransactionReceipt({ hash: h })).contractAddress!;
  console.log(`\nESCROW_ADDRESS=${escrow}\nTOKEN_ADDRESS=${token}\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
