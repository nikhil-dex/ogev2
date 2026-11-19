// Best-effort owner-scoped, browser-local copy of recently opened GitHub Notes.
// This enables editing the last-read Notes after a reload or network outage.
// It never becomes the authoritative write source.
export const MAX_VAULT_READ_CACHE_BYTES = 512 * 1024;
export function vaultReadCacheKey(ownerId, repoId) {
  if (typeof ownerId !== 'string' || !ownerId || !Number.isSafeInteger(repoId) || repoId < 1)
    throw new TypeError('Invalid Vault cache identity.');
  return 'oge:vault:read-cache:' + ownerId + ':' + repoId;
}

export function saveVaultReadCache(storage, key, subjects, notes, now = Date.now()) {
  if (!Array.isArray(subjects) || !Array.isArray(notes) || !Number.isFinite(now)) return false;
  const safe = {
    v: 1, savedAt: now, subjects: subjects.slice(0, 100),
    notes: notes.slice(0, 30),
  };
  const value = JSON.stringify(safe);
  if (new TextEncoder().encode(value).byteLength > MAX_VAULT_READ_CACHE_BYTES) return false;
  try { storage.setItem(key, value); return true; } catch { return false; }
}

export function readVaultReadCache(storage, key, now = Date.now()) {
  try {
    const raw = storage.getItem(key);
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_VAULT_READ_CACHE_BYTES) return null;
    const saved = JSON.parse(raw);
    if (saved?.v !== 1 || !Array.isArray(saved.notes) || !Array.isArray(saved.subjects) ||
        !Number.isSafeInteger(saved.savedAt) || now < saved.savedAt ||
        now - saved.savedAt > 14 * 24 * 60 * 60 * 1000 ||
        saved.notes.some((note) => typeof note?.id !== 'string' ||
          typeof note.heading !== 'string' || typeof note.answer !== 'string' ||
          typeof note.subjectSlug !== 'string')) return null;
    return saved;
  } catch { return null; }
}
