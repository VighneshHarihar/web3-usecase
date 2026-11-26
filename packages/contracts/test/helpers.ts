import hre from 'hardhat';
import assert from 'node:assert/strict';
import { keccak256, toHex, type Hex } from 'viem';

export const DAY = 86_400n;
let counter = 0;
export const id = (label = 'x'): Hex => keccak256(toHex(`${label}-${++counter}-${Math.random()}`));

export async function expectRevert(p: Promise<unknown>, name: string) {
  try {
    await p;
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    assert.ok(msg.includes(name), `expected revert ${name}, got: ${msg.slice(0, 400)}`);
    return;
  }
  assert.fail(`expected revert ${name}, but call succeeded`);
}

export async function now(): Promise<bigint> {
  const pc = await hre.viem.getPublicClient();
  const b = await pc.getBlock();
  return b.timestamp;
}

export async function increase(seconds: bigint | number) {
  await hre.network.provider.send('evm_increaseTime', [Number(seconds)]);
  await hre.network.provider.send('evm_mine', []);
}

export const Kind = { Credit: 1, Percent: 2 } as const;

export function offerParams(over: Partial<Record<string, unknown>> = {}) {
  return {
    kind: Kind.Percent,
    percentBps: 2000,
    minPurchases: 3,
    windowSecs: Number(30n * DAY),
    validitySecs: Number(60n * DAY),
    maxEnrolments: 100,
    perCustomerLimit: 1,
    rewardValue: 30_000n,
    minTotalSpend: 150_000n,
    minPurchaseAmount: 20_000n,
    termsHash: keccak256(toHex('terms')),
    ...over,
  } as const;
}

export async function deploy(fee = 200) {
  const [admin, guardian, other] = await hre.viem.getWalletClients();
  const token = await hre.viem.deployContract('TestRupee', [admin.account.address]);
  const escrow = await hre.viem.deployContract('LoyaltyEscrow', [
    token.address, admin.account.address, admin.account.address, guardian.account.address, fee, 72n * 3600n,
  ]);
  await token.write.approve([escrow.address, 2n ** 255n]);
  const merchant = id('m');
  await escrow.write.registerMerchant([merchant]);
  async function fund(amount: bigint, m: Hex = merchant) {
    await token.write.mint([admin.account.address, amount]);
    await escrow.write.deposit([m, amount]);
  }
  async function merchantState(m: Hex = merchant) {
    const [exists, frozen, available, committed, owed] = await escrow.read.merchants([m]);
    return { exists, frozen, available, committed, owed };
  }
  return { admin, guardian, other, token, escrow, merchant, fund, merchantState };
}
