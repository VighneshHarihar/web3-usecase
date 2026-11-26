/** UUID ⇄ bytes32 (left-padded) used as on-chain ids. */
export function uuidToBytes32(uuid: string): `0x${string}` {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error(`not a uuid: ${uuid}`);
  return `0x${hex.padStart(64, '0')}`;
}

export function bytes32ToUuid(b: string): string {
  const hex = b.replace(/^0x/, '').slice(-32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const shortRef = (uuid: string) => uuid.replace(/-/g, '').slice(0, 6).toUpperCase();
