/**
 * Invisible Chain step 3: words that must never appear in the default (non-proof) UI.
 * Checked by a unit test over apps/web i18n dictionaries.
 */
export const BANNED_WORDS = [
  'wallet', 'gas', 'token', 'blockchain', 'crypto', 'usdc', 'web3', 'nft',
  'transaction', 'hash', 'smart contract', 'seed phrase', 'private key', 'on-chain', 'onchain',
  'वॉलेट', 'टोकन', 'ब्लॉकचेन', 'क्रिप्टो',
] as const;

export function findBannedWords(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_WORDS.filter((w) => new RegExp(`(^|[^\\p{L}])${w}($|[^\\p{L}])`, 'u').test(lower));
}
