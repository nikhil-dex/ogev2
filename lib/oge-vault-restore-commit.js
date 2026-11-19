import { createHash } from 'node:crypto';
import { validVaultRestorePath } from './oge-vault-zip-restore.js';

const SHA = /^[a-f0-9]{40}$/i;
export const MAX_RESTORE_BLOB_BYTES = 20 * 1024 * 1024;

function verifySha(value) {
  return typeof value === 'string' && SHA.test(value);
}

export function gitRestoreBlobSha(bytes) {
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

export async function readVaultRestoreTree(client) {
  const ref = await client.call('/git/ref/heads/' + encodeURIComponent(client.branch));
  const head = ref?.object?.sha;
  if (!verifySha(head)) throw new TypeError('Invalid current Vault revision.');
  const commit = await client.call('/git/commits/' + head);
  const treeSha = commit?.tree?.sha;
  if (!verifySha(treeSha)) throw new TypeError('Invalid current Vault tree.');
  const tree = await client.call('/git/trees/' + treeSha + '?recursive=1');
  if (!Array.isArray(tree?.tree) || tree.truncated || tree.tree.length > 30000)
    throw new TypeError('Vault file index is incomplete.');
  const files = tree.tree.filter((item) => item.type === 'blob')
    .map((item) => ({ path: item.path, sha: item.sha }));
  if (files.some((item) => !validVaultRestorePath(item.path) || !verifySha(item.sha)))
    throw new TypeError('Vault tree has unsupported paths.');
  return { head, treeSha, files };
}

export async function uploadVaultRestoreBlob(client, bytes, expectedSha) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_RESTORE_BLOB_BYTES ||
      !verifySha(expectedSha) || gitRestoreBlobSha(bytes) !== expectedSha)
    throw new TypeError('Backup file checksum does not match the upload.');
  const result = await client.call('/git/blobs', {
    method: 'POST', body: { encoding: 'base64', content: bytes.toString('base64') },
  });
  if (result?.sha !== expectedSha) throw new Error('GitHub did not verify the backup blob.');
  return { sha: result.sha };
}

export async function commitVaultRestore(client, { head, entries }) {
  if (!verifySha(head) || !Array.isArray(entries) || !entries.length || entries.length > 6000)
    throw new TypeError('Select a valid backup and missing file list.');
  const seen = new Set();
  for (const entry of entries) {
    if (!validVaultRestorePath(entry?.path) || !verifySha(entry?.sha) || seen.has(entry.path))
      throw new TypeError('Backup contains an invalid or duplicate path.');
    seen.add(entry.path);
  }
  const live = await readVaultRestoreTree(client);
  if (live.head !== head) return { conflict: true, reason: 'Vault changed. Recheck the backup before restoring.' };
  const current = new Map(live.files.map((entry) => [entry.path, entry.sha]));
  // No implicit overwrites, even when the archive contains older data.
  if (entries.some((entry) => current.has(entry.path)))
    return { conflict: true, reason: 'A file now exists at a restore path. Recheck conflicts before restoring.' };
  const tree = await client.call('/git/trees', {
    method: 'POST',
    body: {
      base_tree: live.treeSha,
      tree: entries.map((entry) => ({
        path: entry.path, mode: '100644', type: 'blob', sha: entry.sha,
      })),
    },
  });
  if (!verifySha(tree?.sha)) throw new Error('GitHub did not accept the restore tree.');
  const commit = await client.call('/git/commits', {
    method: 'POST',
    body: {
      message: 'Restore missing Oge Vault files from selected backup',
      tree: tree.sha, parents: [head],
    },
  });
  if (!verifySha(commit?.sha)) throw new Error('GitHub did not accept the restore commit.');
  await client.call('/git/refs/heads/' + encodeURIComponent(client.branch), {
    method: 'PATCH', body: { sha: commit.sha, force: false },
  });
  const confirmed = await client.call('/git/ref/heads/' + encodeURIComponent(client.branch));
  if (confirmed?.object?.sha !== commit.sha)
    throw new Error('GitHub restore write could not be confirmed.');
  return { restored: entries.length, commitSha: commit.sha, conflict: false };
}
