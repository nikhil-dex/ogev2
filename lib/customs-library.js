import { VaultGitHubError } from './oge-vault-github.js';

const TYPES = new Map([
  ['html', ['.html', '.htm', 'text/html']],
  ['pdf', ['.pdf', 'application/pdf']],
  ['image', ['.png', 'image/png']],
  ['image', ['.jpg', 'image/jpeg']],
  ['image', ['.jpeg', 'image/jpeg']],
  ['image', ['.webp', 'image/webp']],
  ['image', ['.gif', 'image/gif']],
  ['image', ['.avif', 'image/avif']],
].map(([kind, extension, mime]) => [extension, { kind, mime }]));

const NAME_PATTERN = /^[^\\/\u0000-\u001f\u007f]{1,180}$/;
const SHA = /^[a-f0-9]{40}$/i;
export const MAX_CUSTOM_BYTES = 10 * 1024 * 1024;
export const MAX_CUSTOM_FILES = 500;

export function customFileType(name) {
  if (typeof name !== 'string' || !NAME_PATTERN.test(name) || name === '.' || name === '..') return null;
  const dot = name.lastIndexOf('.');
  return dot < 0 ? null : TYPES.get(name.slice(dot).toLowerCase()) || null;
}

export function customFileLink(name) {
  if (!customFileType(name)) throw new TypeError('Unsupported custom file name.');
  return '/api/vault/customs?file=' + encodeURIComponent(name);
}

// List only the signed-in owner's own private GitHub Vault /customs folder.
// A 404 means the optional folder is absent, not an empty database collection.
export async function listVaultCustoms(client) {
  let items;
  try {
    items = await client.call('/contents/customs?ref=' + encodeURIComponent(client.branch));
  } catch (error) {
    if (error instanceof VaultGitHubError && error.status === 404) return { exists: false, files: [] };
    throw error;
  }
  if (!Array.isArray(items)) throw new VaultGitHubError('vault-customs-not-a-folder', 409);
  if (items.length > MAX_CUSTOM_FILES) throw new VaultGitHubError('vault-customs-too-many-files', 409);
  const files = items
    .filter((item) => item.type === 'file' && customFileType(item.name) &&
      typeof item.size === 'number' && item.size >= 0 && item.size <= MAX_CUSTOM_BYTES &&
      SHA.test(item.sha || '') && item.path === 'customs/' + item.name)
    .map((item) => ({
      name: item.name,
      title: item.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || item.name,
      type: customFileType(item.name).kind,
      url: customFileLink(item.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { exists: true, files };
}

export async function readVaultCustomFile(client, name) {
  const type = customFileType(name);
  if (!type) throw new TypeError('Unsupported custom file name.');
  const { files, exists } = await listVaultCustoms(client);
  if (!exists || !files.some((file) => file.name === name))
    throw new VaultGitHubError('vault-custom-file-missing', 404);
  const listing = await client.call('/contents/customs?ref=' + encodeURIComponent(client.branch));
  const entry = Array.isArray(listing) ? listing.find((item) =>
    item.type === 'file' && item.path === 'customs/' + name && item.name === name &&
    SHA.test(item.sha || '') && Number.isSafeInteger(item.size) && item.size <= MAX_CUSTOM_BYTES) : null;
  if (!entry) throw new VaultGitHubError('vault-custom-file-missing', 404);
  // Read the immutable blob SHA from the confirmed folder listing.
  const blob = await client.call('/git/blobs/' + entry.sha);
  if (blob?.encoding !== 'base64' || typeof blob.content !== 'string' || blob.sha !== entry.sha)
    throw new VaultGitHubError('vault-custom-file-invalid', 409);
  const bytes = Buffer.from(blob.content.replace(/\s/g, ''), 'base64');
  if (bytes.length !== entry.size || bytes.length > MAX_CUSTOM_BYTES)
    throw new VaultGitHubError('vault-custom-file-invalid', 409);
  return { bytes, mime: type.mime, name, kind: type.kind };
}
