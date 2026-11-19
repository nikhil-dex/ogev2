import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validVaultRestorePath, restoreGroup, inspectVaultZip, planVaultZipRestore } from '../lib/oge-vault-zip-restore.js';
import { gitRestoreBlobSha, commitVaultRestore, uploadVaultRestoreBlob } from '../lib/oge-vault-restore-commit.js';
import { vaultOfflineQueueKey, readVaultOfflineQueue, enqueueVaultOfflineChange,
  removeVaultOfflineChange, classifyVaultOfflineConflict } from '../lib/oge-vault-offline-queue.js';

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function zip(paths) {
  const localChunks = [], central = [];
  let offset = 0;
  for (const [name, text] of paths) {
    const path = Buffer.from('ogenotes-vault-main/' + name);
    const bytes = Buffer.from(text);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt32LE(crc32(bytes), 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(path.length, 26);
    localChunks.push(local, path, bytes);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt32LE(crc32(bytes), 16);
    directory.writeUInt32LE(bytes.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(path.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, path);
    offset += local.length + path.length + bytes.length;
  }
  const size = central.reduce((total, chunk) => total + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(paths.length, 8);
  end.writeUInt16LE(paths.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localChunks, ...central, end]);
}
const NOTE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUBJECT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SHA = 'a'.repeat(40);

test('Vault ZIP supports committed Notes, Quick Notes, AirNotes, Links, My Files and Customs', async () => {
  const archive = zip([
    ['notes/a.json', '{"heading":"Study"}'],
    ['quick-notes/q.json', '{}'],
    ['airnotes/a.json', '{}'],
    ['saved-links/l.json', '{}'],
    ['files/index.json', '{}'],
    ['files/objects/part-0000', 'file bytes'],
    ['customs/lesson.pdf', '%PDF-1.7'],
  ]);
  const parsed = await inspectVaultZip(archive);
  assert.equal(parsed.files.length, 7);
  assert.deepEqual(new Set(parsed.files.map((file) => file.group)),
    new Set(['Notes', 'Quick Notes', 'AirNotes', 'Saved Links', 'My Files', 'Customs']));
  const first = parsed.files[0];
  assert.equal(first.sha, createHash('sha1').update('blob ' +
    first.size + '\0').update(first.bytes).digest('hex'));
  const current = { head: SHA, files: [
    { path: 'notes/a.json', sha: first.sha },
    { path: 'customs/lesson.pdf', sha: 'c'.repeat(40) },
  ] };
  const plan = planVaultZipRestore(parsed, current);
  assert.equal(plan.identical.length, 1);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.missing.length, 5);
});

test('Vault ZIP rejects corrupt checksum, traversal, duplicate and untrusted input', async () => {
  const ok = zip([['notes/a.json', 'valid']]);
  const broken = Buffer.from(ok);
  broken[broken.indexOf('valid')] ^= 1;
  await assert.rejects(inspectVaultZip(broken), /checksum mismatch/);
  await assert.rejects(inspectVaultZip(zip([['../escape', 'abc']])), /unsafe path/);
  await assert.rejects(inspectVaultZip(zip([['notes/a.json', 'a'], ['notes/a.json', 'b']])), /duplicate/);
  assert.equal(validVaultRestorePath('notes/a.json'), true);
  assert.equal(validVaultRestorePath('../private'), false);
  assert.equal(validVaultRestorePath('notes/../private'), false);
  assert.equal(validVaultRestorePath('notes\\fake'), false);
  assert.equal(restoreGroup('customs/notes.pdf'), 'Customs');
});

test('Restore commit refuses to overwrite new or existing GitHub files', async () => {
  const calls = [];
  let currentHead = SHA;
  const tree = 'b'.repeat(40), newTree = 'c'.repeat(40), newCommit = 'd'.repeat(40);
  const existing = new Map([['notes/live.json', 'e'.repeat(40)]]);
  const client = { branch: 'main', call: async (path, options = {}) => {
    calls.push({ path, options });
    if (path === '/git/ref/heads/main') return { object: { sha: currentHead } };
    if (path === '/git/commits/' + SHA) return { tree: { sha: tree } };
    if (path === '/git/trees/' + tree + '?recursive=1')
      return { truncated: false, tree: [...existing.entries()].map(([name, sha]) =>
        ({ path: name, sha, type: 'blob' })) };
    if (path === '/git/trees') return { sha: newTree };
    if (path === '/git/commits') return { sha: newCommit };
    if (path === '/git/refs/heads/main') {
      assert.equal(options.body.force, false);
      currentHead = options.body.sha;
      return { object: { sha: newCommit } };
    }
    throw new Error('Unexpected GitHub operation ' + path);
  } };
  const conflict = await commitVaultRestore(client, {
    head: SHA, entries: [{ path: 'notes/live.json', sha: 'f'.repeat(40) }],
  });
  assert.equal(conflict.conflict, true);
  assert.equal(calls.some((call) => call.path === '/git/trees'), false);
  const restored = await commitVaultRestore(client, {
    head: SHA, entries: [{ path: 'customs/study.pdf', sha: 'f'.repeat(40) }],
  });
  assert.deepEqual(restored, { restored: 1, commitSha: newCommit, conflict: false });
  assert.equal(calls.some((call) => call.path === '/git/refs/heads/main'), true);
});

test('Backup blobs must have correct Git hash before upload', async () => {
  const bytes = Buffer.from('private GitHub file');
  const sha = gitRestoreBlobSha(bytes);
  let count = 0;
  const client = { call: async () => { count++; return { sha }; } };
  await assert.rejects(uploadVaultRestoreBlob(client, bytes, SHA));
  assert.equal(count, 0);
  await uploadVaultRestoreBlob(client, bytes, sha);
  assert.equal(count, 1);
});

test('Offline Notes remain locally queued until user selects sync and conflicts are explicit', () => {
  const state = new Map();
  const storage = { getItem: (k) => state.get(k) ?? null, setItem: (k, v) => state.set(k, v) };
  const key = vaultOfflineQueueKey('owner', 42);
  const update = { id: NOTE_ID, action: 'update', subjectId: SUBJECT_ID,
    baseSha: SHA, heading: 'Hello', answer: 'Unsent changes', tags: [] };
  enqueueVaultOfflineChange(storage, key, update);
  enqueueVaultOfflineChange(storage, key, { ...update, answer: 'More local text' });
  assert.equal(readVaultOfflineQueue(storage, key).length, 1);
  assert.equal(readVaultOfflineQueue(storage, key)[0].answer, 'More local text');
  assert.equal(classifyVaultOfflineConflict(update, {
    id: NOTE_ID, subjectSlug: SUBJECT_ID, sha: SHA,
  }), 'ready');
  assert.equal(classifyVaultOfflineConflict(update, {
    id: NOTE_ID, subjectSlug: SUBJECT_ID, sha: 'b'.repeat(40),
  }), 'conflict');
  assert.equal(classifyVaultOfflineConflict(update, null), 'conflict');
  assert.equal(classifyVaultOfflineConflict({ ...update, action: 'create' }, null), 'ready');
  assert.throws(() => enqueueVaultOfflineChange(storage, key, { ...update, baseSha: 'b'.repeat(40) }));
  assert.equal(removeVaultOfflineChange(storage, key, NOTE_ID).length, 0);
});

test('Recovery and offline changes use current authenticated GitHub Vault routes', async () => {
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  const route = await read('../app/api/vault/restore/route.js');
  const page = await read('../app/vault/backup/page.js');
  const ui = await read('../app/notes/page.js');
  const offline = await read('../app/components/vault-offline-queue.js');
  assert.match(route, /ownerMutationFilter\(ownerId, \{ sessionVersion \}\)/);
  assert.match(route, /connectedVaultStorageAvailable\(account\)/);
  assert.match(route, /commitVaultRestore\(ctx\.client, input\)/);
  assert.match(page, /<VaultZipRestore \/>/);
  assert.match(ui, /enqueueVaultOfflineChange\(window\.localStorage/);
  assert.match(ui, /Save offline \(sync later\)/);
  assert.match(offline, /status === 'conflict'/);
  assert.match(offline, /'GitHub changed since your review/);
});
