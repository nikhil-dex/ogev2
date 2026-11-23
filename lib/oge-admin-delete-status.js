/**
 * Keep deletion failures actionable without exposing database exception text
 * or pretending GitHub data was deleted.
 */
export function adminDeletionFailureStatus(error) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Vault account deletion is disabled')) return 'vault-connected';
  if (message.includes('Vault recovery data exists')) return 'vault-recovery';
  if (message.includes('Account session changed') || message.includes('Account deletion conflict')) return 'conflict';
  if (message.includes('Transaction numbers are only allowed') ||
      message.includes('replica set') || message.includes('does not support transactions')) return 'transaction';
  return 'blocked';
}
