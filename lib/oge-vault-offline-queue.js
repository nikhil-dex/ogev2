// Owner/repository-scoped offline intent queue.
// Saved locally until the user explicitly reviews and confirms a GitHub write.
export const MAX_OFFLINE_CHANGES = 25;
export const MAX_OFFLINE_QUEUE_BYTES = 512 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/i;

export function vaultOfflineQueueKey(ownerId, repoId) {
  if (!ownerId || !Number.isSafeInteger(repoId) || repoId < 1)
    throw new TypeError('Invalid offline Vault identity.');
  return 'oge:vault:offline-edits:' + ownerId + ':' + repoId;
}

function validateChange(item) {
  if (!item || !UUID.test(item.id || '') || !UUID.test(item.subjectId || '') ||
      !['create', 'update'].includes(item.action) ||
      (item.action === 'update' && !SHA.test(item.baseSha || '')) ||
      (item.action === 'create' && item.baseSha !== null) ||
      typeof item.heading !== 'string' || !item.heading.trim() || item.heading.length > 160 ||
      typeof item.answer !== 'string' || !item.answer.trim() || item.answer.length > 20000 ||
      !Array.isArray(item.tags) || item.tags.length > 10 ||
      item.tags.some((tag) => typeof tag !== 'string' || tag.length > 40))
    throw new TypeError('Invalid offline Note. Include a heading, subject and content.');
  return { id: item.id.toLowerCase(), action: item.action,
    subjectId: item.subjectId.toLowerCase(), baseSha: item.baseSha,
    heading: item.heading, answer: item.answer, tags: item.tags };
}

export function readVaultOfflineQueue(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    if (new TextEncoder().encode(raw).length > MAX_OFFLINE_QUEUE_BYTES)
      throw new TypeError('Offline queue is too large.');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > MAX_OFFLINE_CHANGES)
      throw new TypeError('Offline queue is invalid.');
    const validated = parsed.map(validateChange);
    if (new Set(validated.map((item) => item.id)).size !== validated.length)
      throw new TypeError('Duplicate offline Notes.');
    return validated;
  } catch (error) {
    // Never silently erase queued drafts if localStorage becomes inaccessible.
    throw new TypeError('Offline drafts could not be read. Preserve this browser profile.', { cause: error });
  }
}

export function enqueueVaultOfflineChange(storage, key, input) {
  const change = validateChange(input);
  const current = readVaultOfflineQueue(storage, key);
  const index = current.findIndex((item) => item.id === change.id);
  if (index >= 0 && (current[index].baseSha !== change.baseSha ||
      current[index].action !== change.action))
    throw new TypeError('Offline Note has a different base version. Review first.');
  const next = index >= 0
    ? current.map((item, i) => i === index ? change : item)
    : [...current, change];
  if (next.length > MAX_OFFLINE_CHANGES ||
      new TextEncoder().encode(JSON.stringify(next)).length > MAX_OFFLINE_QUEUE_BYTES)
    throw new TypeError('Offline queue is full. Reconnect and sync existing Notes.');
  storage.setItem(key, JSON.stringify(next));
  return next;
}

export function removeVaultOfflineChange(storage, key, id) {
  const current = readVaultOfflineQueue(storage, key);
  const next = current.filter((item) => item.id !== id);
  storage.setItem(key, JSON.stringify(next));
  return next;
}

export function offlineMatchesGitHub(local, remote) {
  return Boolean(remote && remote.id === local.id &&
    remote.subjectSlug === local.subjectId &&
    remote.heading === local.heading && remote.answer === local.answer &&
    JSON.stringify(remote.tags || []) === JSON.stringify(local.tags));
}

export function classifyVaultOfflineConflict(local, remote) {
  if (offlineMatchesGitHub(local, remote)) return 'already-synced';
  if (local.action === 'create') return remote ? 'conflict' : 'ready';
  if (!remote || remote.id !== local.id ||
      remote.subjectSlug !== local.subjectId || remote.sha !== local.baseSha)
    return 'conflict';
  return 'ready';
}
