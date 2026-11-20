import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nextReviewDate, nextReviewSchedule, progressKey, recordVaultReview, annotateVaultStudyPage } from '../lib/oge-vault-study.js';
import { vaultReadCacheKey, saveVaultReadCache, readVaultReadCache } from '../lib/oge-vault-read-cache.js';
import { readVaultBackupManifest } from '../lib/oge-vault-backup-manifest.js';

test('GitHub study due intervals and identity are bounded', () => {
  const now = new Date('2026-11-19T10:00:00Z');
  assert.equal(nextReviewDate('again', now).toISOString(), '2026-11-19T10:10:00.000Z');
  assert.equal(nextReviewDate('easy', now).toISOString(), '2026-11-23T10:00:00.000Z');
  assert.equal(nextReviewSchedule('good', { intervalDays: 3 }, now).intervalDays, 6);
  assert.equal(nextReviewSchedule('hard', { intervalDays: 5 }, now).intervalDays, 6);
  assert.equal(nextReviewSchedule('easy', { intervalDays: 4 }, now).intervalDays, 10);
  assert.throws(() => nextReviewDate('invalid'));
  assert.equal(progressKey('owner', 2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'owner:2:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.throws(() => progressKey('', 2, 'bad'));
});

test('Study progress stores metadata, not the note body', async () => {
  const calls = [];
  const db = { collection() { return {
    async findOne() { return null; },
    async updateOne(filter, update, options) { calls.push({ filter, update, options }); },
    find() { return { toArray: async () => [] }; },
  }; } };
  const client = { vault: { repoId: 42 } };
  const note = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', subjectId: 'study',
    heading: 'Secret heading', answer: 'Private answer', updatedAt: '2026-11-19' };
  const result = await recordVaultReview(db, client, 'owner', note, 'good',
    new Date('2026-11-19T10:00:00Z'));
  assert.equal(result.rating, 'good');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].update.$set.intervalDays, 1);
  assert.ok(!JSON.stringify(calls).includes('Private answer'));
  assert.ok(!JSON.stringify(calls).includes('Secret heading'));
  const annotated = await annotateVaultStudyPage(db, client, 'owner', [note]);
  assert.equal(annotated[0].due, true);
  assert.equal(annotated[0].heading, note.heading);
});

test('Offline cache is owner-specific, bounded and expires after 14 days', () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  const key = vaultReadCacheKey('owner', 123);
  assert.notEqual(key, vaultReadCacheKey('other', 123));
  const note = { id: 'x', heading: 'H', answer: 'A', subjectSlug: 'study' };
  assert.equal(saveVaultReadCache(storage, key, [{ slug: 'study' }], [note], 1000), true);
  assert.equal(readVaultReadCache(storage, key, 2000).notes[0].answer, 'A');
  assert.equal(readVaultReadCache(storage, key, 15 * 24 * 60 * 60 * 1000), null);
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


test('Adaptive Vault review reads previous interval and stores only progress metadata', async () => {
  const calls = [];
  const db = { collection() { return {
    async findOne() { return { intervalDays: 3 }; },
    async updateOne(filter, update) { calls.push({ filter, update }); },
  }; } };
  const note = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    subjectId: 'machine-learning', heading: 'Private heading', answer: 'Private answer' };
  const result = await recordVaultReview(db, { vault: { repoId: 7 } }, 'owner',
    note, 'good', new Date('2026-11-19T10:00:00Z'));
  assert.equal(result.intervalDays, 6);
  assert.equal(result.reviewDueAt, '2026-11-25T10:00:00.000Z');
  assert.ok(!JSON.stringify(calls).includes('Private answer'));
  assert.ok(!JSON.stringify(calls).includes('Private heading'));
});

test('Vault flashcards support study modes, subject filtering, navigation and Markdown', async () => {
  const source = await readFile(new URL('../app/vault/study/study-client.js', import.meta.url), 'utf8');
  for (const feature of ['Review Due', 'Study All', 'study-subject',
    'Previous', 'Next', 'Shuffle', 'Skip for now', 'Reveal answer']) {
    assert.ok(source.includes(feature), feature);
  }
  assert.match(source, /markdownHtml\(note\.answer\)/);
  assert.match(source, /reviewedIds/);
  assert.match(source, /setCompleted\(\(n\) => n \+ 1\)/);
  assert.match(source, /Scan next 20 Notes/);
});
