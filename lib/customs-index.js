import { listVaultCustoms } from './customs-library.js';

// A small owner-scoped metadata cache, not a second file storage system.
// File bytes remain in the user's private GitHub Vault repository.
export const CUSTOMS_INDEX_COLLECTION = 'vaultCustomsIndexes';
export const CUSTOMS_INDEX_AGE_MS = 60 * 1000;

function indexFilter(ownerId, repoId) {
  return { _id: ownerId + ':' + repoId };
}

function usableIndex(row, repoId, branch, now, maxAgeMs) {
  return row?.repoId === repoId && row.branch === branch &&
    row.scannedAt instanceof Date && now.getTime() - row.scannedAt.getTime() < maxAgeMs &&
    row.scannedAt.getTime() <= now.getTime() &&
    typeof row.exists === 'boolean' && Array.isArray(row.files);
}

export async function getIndexedCustoms(db, client, ownerId, {
  refresh = false, now = new Date(), maxAgeMs = CUSTOMS_INDEX_AGE_MS,
} = {}) {
  const repoId = client.vault.repoId;
  if (!Number.isSafeInteger(repoId) || repoId <= 0 || !ownerId)
    throw new TypeError('Invalid Vault index ownership.');
  const filter = indexFilter(ownerId, repoId);
  const collection = db.collection(CUSTOMS_INDEX_COLLECTION);
  if (!refresh) {
    const cached = await collection.findOne(filter);
    if (usableIndex(cached, repoId, client.branch, now, maxAgeMs))
      return { exists: cached.exists, files: cached.files, indexedAt: cached.scannedAt.toISOString(), source: 'index' };
  }
  // On first open, or after expiry/manual refresh, read the live Vault folder.
  const current = await listVaultCustoms(client);
  const scannedAt = now;
  await collection.updateOne(filter, {
    $set: {
      ownerId, repoId, branch: client.branch,
      exists: current.exists, files: current.files, scannedAt,
    },
  }, { upsert: true });
  return { ...current, indexedAt: scannedAt.toISOString(), source: 'github' };
}
