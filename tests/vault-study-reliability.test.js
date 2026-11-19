import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nextReviewDate, progressKey, recordVaultReview, annotateVaultStudyPage } from '../lib/oge-vault-study.js';
import { vaultReadCacheKey, saveVaultReadCache, readVaultReadCache } from '../lib/oge-vault-read-cache.js';
import { readVaultBackupManifest } from '../lib/oge-vault-backup-manifest.js';

test('GitHub study due intervals and identity are bounded', () => {
  const now = new Date('2026-11-19T10:00:00Z');
  assert.equal(nextReviewDate('again', now).toISOString(), '2026-11-20T10:00:00.000Z');
  assert.equal(nextReviewDate('easy', now).toISOString(), '2026-12-03T10:00:00.000Z');
  assert.throws(() => nextReviewDate('invalid'));
  assert.equal(progressKey('owner', 2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'owner:2:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.throws(() => progressKey('', 2, 'bad'));
});

test('Study progress stores metadata, not the note body', async () => {
  const calls = [];
  const db = { collection() { return {
    async updateOne(filter, update, options) { calls.push({ filter, update, options }); },
    async find() { return { toArray: async () => [] }; },
  }; } };
  const client = { vault: { repoId: 42 } };
  const note = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', subjectId: 'study',
    heading: 'Secret heading', answer: 'Private answer', updatedAt: '2026-11-19' };
  const result = await recordVaultReview(db, client, 'owner', note, 'good',
    new Date('2026-11-19T10:00:00Z'));
  assert.equal(result.rating, 'good');
  assert.equal(calls.length, 1);
  assert.ok(!JSON.stringify(calls).includes('Private answer'));
  assert.ok(!JSON.stringify(calls).includes('Secret heading'));
  const annotated = await annotateVaultStudyPage(db, client, 'owner', [note]);
  assert.equal(annotated[0].due, true);
  assert.equal(annotated[0].heading, note.heading);
});

test('Offline cache is owner-specific, read-only, bounded and expires', () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  const key = vaultReadCacheKey('owner', 123);
  assert.notEqual(key, vaultReadCacheKey('other', 123));
  const note = { id: 'x', heading: 'H', answer: 'A', subjectSlug: 'study' };
  assert.equal(saveVaultReadCache(storage, key, [{ slug: 'study' }], [note], 1000), true);
  assert.equal(readVaultReadCache(storage, key, 2000).notes[0].answer, 'A');
  assert.equal(readVaultReadCache(storage, key, 25 * 60 * 60 * 1000), null);
  assert.equal(saveVaultReadCache(storage, key, [], [{ ...note, answer: 'x'.repeat(600000) }]), false);
});

test('Complete ZIP manifest enumerates non-Notes resources and detects concurrent changes', async () => {
  const sha = 'a'.repeat(40);
  const entries = ['notes/n.json', 'quick-notes/q.json', 'airnotes/a.json',
    'saved-links/s.json', 'media/file.json', 'customs/study.pdf', 'misc/other.json']
    .map((path) => ({ type: 'blob', path, sha }));
  const client = { branch: 'main', call: async (path) => {
    if (path === '/git/ref/heads/main') return { object: { sha } };
    if (path === '/git/commits/' + sha) return { tree: { sha } };
    if (path === '/git/trees/' + sha + '?recursive=1') return { tree: entries, truncated: false };
    throw new Error('Unexpected GitHub API call: ' + path);
  } };
  const report = await readVaultBackupManifest(client);
  assert.equal(report.totalCommittedFiles, 7);
  assert.equal(report.groups.customs, 1);
  assert.equal(report.groups.other, 1);
  assert.equal(report.completeTree, true);
});

test('New Vault-only workspaces and Customs recovery are wired into home', async () => {
  const home = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');
  const customs = await readFile(new URL('../app/customs/page.js', import.meta.url), 'utf8');
  const study = await readFile(new URL('../app/api/vault/study/route.js', import.meta.url), 'utf8');
  assert.match(home, /href: '\/vault\/study'/);
  assert.match(home, /href: '\/vault\/backup'/);
  assert.match(home, /account\.notesStorage === 'github' && vaultNotesReady/);
  assert.match(customs, /customs\?\.stale/);
  assert.match(study, /readVaultNote\(ctx\.client/);
  assert.match(study, /recordVaultReview\(ctx\.db/);
});
