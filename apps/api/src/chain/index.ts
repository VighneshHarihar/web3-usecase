/**
 * Chain layer: viem clients, local auto-deploy, and read helpers for proof pages.
 * The chain is the quiet witness and the final rule-keeper (docs/03).
 */
import { LoyaltyEscrowAbi, LoyaltyEscrowBytecode, TestRupeeAbi, TestRupeeBytecode } from '@loyallink/contracts/abi';
import { uuidToBytes32 } from '@loyallink/shared';
import fs from 'node:fs';
import path from 'node:path';
import { createPublicClient, createWalletClient, defineChain, http, type Address, type Hex, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sql } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';

export interface ChainCtx {
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: ReturnType<typeof privateKeyToAccount>;
  escrow: Address;
  token: Address;
  chainId: number;
}

let ctx: ChainCtx | null = null;
export const chainStatus = { enabled: false, ready: false, lastError: null as string | null, deployedFresh: false };

export function chainEnabled() {
  return config.CHAIN_MODE !== 'off';
}

const deploymentsFile = () => path.resolve(process.cwd(), '.deployments', `chain-${config.CHAIN_ID}.json`);

export async function initChain(): Promise<ChainCtx | null> {
  chainStatus.enabled = chainEnabled();
  if (!chainEnabled()) return null;
  if (ctx) return ctx;
  const chain = defineChain({
    id: config.CHAIN_ID,
    name: config.CHAIN_NAME,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [config.RPC_URL] } },
  });
  const account = privateKeyToAccount(config.OPERATOR_PRIVATE_KEY as Hex);
  const publicClient = createPublicClient({ chain, transport: http(config.RPC_URL) }) as PublicClient;
  const walletClient = createWalletClient({ chain, account, transport: http(config.RPC_URL) });

  let escrow = config.ESCROW_ADDRESS as Address | undefined;
  let token = config.TOKEN_ADDRESS as Address | undefined;
  if (!escrow || !token) {
    if (config.CHAIN_MODE !== 'local') throw new Error('ESCROW_ADDRESS and TOKEN_ADDRESS are required when CHAIN_MODE=rpc');
    const saved = readSaved();
    const hasCode = async (a?: string) => !!a && ((await publicClient.getCode({ address: a as Address })) ?? '0x') !== '0x';
    if (saved && (await hasCode(saved.escrow)) && (await hasCode(saved.token))) {
      ({ escrow, token } = saved);
    } else {
      ({ escrow, token } = await deployLocal(publicClient, walletClient, account.address));
      fs.mkdirSync(path.dirname(deploymentsFile()), { recursive: true });
      fs.writeFileSync(deploymentsFile(), JSON.stringify({ escrow, token, deployedAt: new Date().toISOString() }, null, 2));
      chainStatus.deployedFresh = true;
      // A fresh local chain: replay the whole ledger onto it.
      await db.execute(sql`update ledger_events set chain_status='pending', attempts=0, next_attempt_at=null, error=null, tx_hash=null, block_number=null where chain_status in ('confirmed','failed')`);
    }
  }
  ctx = { publicClient, walletClient, account, escrow: escrow!, token: token!, chainId: config.CHAIN_ID };
  chainStatus.ready = true;
  return ctx;
}

function readSaved(): { escrow: Address; token: Address } | null {
  try {
    return JSON.parse(fs.readFileSync(deploymentsFile(), 'utf8'));
  } catch {
    return null;
  }
}

/** Dev only: deploy TestRupee + LoyaltyEscrow with the operator as admin/operator/guardian. */
export async function deployLocal(publicClient: PublicClient, walletClient: WalletClient, operator: Address, maxBackdate = 10n * 365n * 86400n) {
  const account = walletClient.account!;
  const tHash = await walletClient.deployContract({ abi: TestRupeeAbi, bytecode: TestRupeeBytecode, args: [operator], account, chain: walletClient.chain });
  const tRec = await publicClient.waitForTransactionReceipt({ hash: tHash });
  const token = tRec.contractAddress!;
  const eHash = await walletClient.deployContract({
    abi: LoyaltyEscrowAbi, bytecode: LoyaltyEscrowBytecode, account, chain: walletClient.chain,
    args: [token, operator, operator, operator, config.FEE_BPS, maxBackdate],
  });
  const eRec = await publicClient.waitForTransactionReceipt({ hash: eHash });
  return { token, escrow: eRec.contractAddress! };
}

export const b32 = (uuid: string) => uuidToBytes32(uuid);

export function getChain() {
  return ctx;
}

export function resetChainForTests() {
  ctx = null;
  chainStatus.ready = false;
}

/** Live on-chain view for proof pages. Returns null when the chain is off or unreachable. */
export async function readOnChain(kind: 'merchant' | 'offer' | 'enrolment' | 'reward', uuid: string) {
  const c = ctx;
  if (!c) return null;
  const id = b32(uuid);
  const read = (functionName: string) =>
    c.publicClient.readContract({ address: c.escrow, abi: LoyaltyEscrowAbi, functionName: functionName as never, args: [id] as never }) as Promise<unknown>;
  try {
    if (kind === 'merchant') {
      const [exists, frozen, available, committed, owed] = (await read('merchants')) as [boolean, boolean, bigint, bigint, bigint];
      return { exists, frozen, available: Number(available), committed: Number(committed), owed: Number(owed) };
    }
    if (kind === 'offer') {
      const o = (await read('offers')) as { merchantId: Hex; p: { termsHash: Hex; rewardValue: bigint }; feeBps: number; enrolled: number; paused: boolean; ended: boolean };
      if (/^0x0+$/.test(o.merchantId)) return { exists: false };
      return { exists: true, termsHash: o.p.termsHash, rewardValue: Number(o.p.rewardValue), feeBps: o.feeBps, enrolled: o.enrolled, paused: o.paused, ended: o.ended };
    }
    if (kind === 'enrolment') {
      const [offerId, customerRef, deadline, purchases, status, spend] = (await read('enrolments')) as [Hex, Hex, bigint, number, number, bigint];
      if (status === 0) return { exists: false };
      return { exists: true, offerId, customerRef, deadline: Number(deadline), purchases, spend: Number(spend), status: ['none', 'active', 'completed', 'expired', 'cancelled'][status] };
    }
    const r = (await read('rewards')) as readonly unknown[];
    const status = Number(r[6]);
    if (status === 0) return { exists: false };
    return { exists: true, customerRef: r[1], status: ['none', 'active', 'used', 'expired', 'revoked'][status], value: Number(r[9] as bigint), remaining: Number(r[10] as bigint), expiresAt: Number(r[8] as bigint) };
  } catch (e) {
    return { error: (e as Error).message.slice(0, 200) };
  }
}

export async function readSolvency() {
  const c = ctx;
  if (!c) return null;
  try {
    const [liabilities, fees, solvent, balance] = await Promise.all([
      c.publicClient.readContract({ address: c.escrow, abi: LoyaltyEscrowAbi, functionName: 'totalLiabilities' }),
      c.publicClient.readContract({ address: c.escrow, abi: LoyaltyEscrowAbi, functionName: 'feesAccrued' }),
      c.publicClient.readContract({ address: c.escrow, abi: LoyaltyEscrowAbi, functionName: 'solvent' }),
      c.publicClient.readContract({ address: c.token, abi: TestRupeeAbi, functionName: 'balanceOf', args: [c.escrow] }),
    ]);
    return { liabilities: Number(liabilities), fees: Number(fees), solvent, balance: Number(balance) };
  } catch (e) {
    return { error: (e as Error).message.slice(0, 200) };
  }
}
