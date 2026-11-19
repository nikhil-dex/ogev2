import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scanAllVaultNoteLinks } from '../lib/oge-vault-all-note-links.js';
import { notePdfBlocks, cleanPdfInline } from '../lib/oge-note-pdf-layout.js';
import {
  validateStudyDay, vaultDailyGoalId, readVaultDailyGoal,
  setVaultDailyGoal, finishVaultDailyReview,
} from '../lib/oge-vault-daily-progress.js';
import { vaultReadCacheKey, readVaultReadCache, saveVaultReadCache } from '../lib/oge-vault-read-cache.js';
import { offlineMatchesGitHub, classifyVaultOfflineConflict } from '../lib/oge-vault-offline-queue.js';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('complete Notes linking scans every page and crosses subject boundaries', async () => {
  const reader = { id: ID, subjectSlug: 'math', heading: 'Binary Search',
    answer: 'Related to [[Arrays]] and [[Indexes]]' };
  const pages = [
    { notes: [reader, { id: OTHER_ID, heading: 'Arrays',
      subjectSlug: 'programming', answer: 'See [[Binary Search]]' }], nextCursor: 'next', total: 3 },
    { notes: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      heading: 'Indexes', subjectSlug: 'database', answer: 'More info' }],
    nextCursor: null, total: 3 },
  ];
  let calls = 0;
  const progress = [];
  const result = await scanAllVaultNoteLinks({
    reader, fetchPage: async (cursor) => {
      assert.equal(cursor, calls === 0 ? null : 'next');
      return pages[calls++];
    }, onProgress: (point) => progress.push(point),
  });
  assert.equal(calls, 2);
  assert.equal(result.complete, true);
  assert.equal(result.scanned, 3);
  assert.equal(result.outgoing.length, 2);
  assert.deepEqual(result.backlinks.map((note) => note.id), [OTHER_ID]);
  assert.deepEqual(progress.map((item) => item.scanned), [2, 3]);
});

test('complete link scans reject stale or truncated pagination and can cancel', async () => {
  const reader = { id: ID, subjectSlug: 'math', heading: 'Topic', answer: '' };
  await assert.rejects(scanAllVaultNoteLinks({
    reader, fetchPage: async () => ({ notes: [reader], total: 2, nextCursor: null }),
  }), /changed/);
  let shouldCancel = true;
  const cancelled = await scanAllVaultNoteLinks({
    reader, fetchPage: async () => { throw new Error('Not called'); },
    shouldStop: () => shouldCancel,
  });
  assert.equal(cancelled.cancelled, true);
  shouldCancel = false;
});

test('PDF export preserves Markdown structure including headings, code, quotes and tables', async () => {
  const blocks = notePdfBlocks('# Title\nParagraph with **bold** and [link](https://example.com)\n' +
    '- important\n> quoted\n\`\`\`javascript\nconst answer = 42;\n\`\`\`\n' +
    '| A | B |\n| --- | --- |\n| one | two |');
  assert.ok(blocks.some((row) => row.kind === 'heading' && row.text === 'Title'));
  assert.ok(blocks.some((row) => row.kind === 'paragraph' &&
    row.text.includes('bold and link')));
  assert.ok(blocks.some((row) => row.kind === 'list'));
  assert.ok(blocks.some((row) => row.kind === 'quote'));
  assert.ok(blocks.some((row) => row.kind === 'code' && row.text.includes('answer = 42')));
  assert.equal(blocks.filter((row) => row.kind === 'table').length, 2);
  assert.equal(cleanPdfInline('Open [[Arrays]] or ![diagram](x.png)'), 'Open Arrays or [Image: diagram]');
  const pdf = await readFile(new URL('../lib/oge-note-pdf.js', import.meta.url), 'utf8');
  assert.match(pdf, /notePdfBlocks\(note\.answer\)/);
  assert.match(pdf, /line\.kind === 'heading'/);
  assert.match(pdf, /line\.kind === 'code'/);
  assert.match(pdf, /\/api\/vault\/media/);
});

function memoryDb() {
  const rows = new Map();
  return { rows, collection: (name) => {
    assert.equal(name, 'vaultStudyDailyGoals');
    return {
      findOne: async ({ _id }) => rows.get(_id) || null,
      updateOne: async ({ _id }, update) => {
        const row = rows.get(_id) || { _id, ...update.$setOnInsert };
        if (update.$set) Object.assign(row, update.$set);
        if (update.$addToSet) {
          row.noteIds ||= [];
          if (!row.noteIds.includes(update.$addToSet.noteIds))
            row.noteIds.push(update.$addToSet.noteIds);
        }
        rows.set(_id, row);
      },
    };
  } };
}

test('daily study goal and reviewed-note count sync across devices and never double count', async () => {
  const db = memoryDb();
  const day = '2026-11-20', owner = 'owner', repoId = 123;
  assert.equal(validateStudyDay(day, new Date('2026-11-20T03:00:00Z')), day);
  assert.equal(vaultDailyGoalId(owner, repoId, day), 'owner:123:2026-11-20');
  await setVaultDailyGoal(db, owner, repoId, day, 15);
  await finishVaultDailyReview(db, owner, repoId, day, ID);
  await finishVaultDailyReview(db, owner, repoId, day, ID);
  await finishVaultDailyReview(db, owner, repoId, day, OTHER_ID);
  const otherDevice = await readVaultDailyGoal(db, owner, repoId, day);
  assert.deepEqual(otherDevice, { date: day, goal: 15, completed: 2 });
  assert.deepEqual(await readVaultDailyGoal(db, owner, repoId, '2026-11-21'),
    { date: '2026-11-21', goal: 10, completed: 0 });
  assert.throws(() => validateStudyDay('2026-11-11', new Date('2026-11-20T12:00:00Z')));
});

test('cached private Notes persist through new browser storage instance and expire after 14 days', () => {
  const data = new Map();
  const browser = () => ({
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
  });
  const key = vaultReadCacheKey('owner', 123);
  const note = { id: ID, subjectSlug: 'math', heading: 'Topic', answer: 'Offline explanation' };
  const start = Date.parse('2026-11-01T12:00:00Z');
  assert.equal(saveVaultReadCache(browser(), key, [], [note], start), true);
  assert.equal(readVaultReadCache(browser(), key, start + 13 * 86400000).notes[0].answer,
    'Offline explanation');
  assert.equal(readVaultReadCache(browser(), key, start + 15 * 86400000), null);
});

test('unsure GitHub Save can be reconciled without overwriting a remote version', async () => {
  const local = { id: ID, action: 'create', subjectId: 'math',
    heading: 'Topic', answer: 'Saved text', tags: [] };
  const same = { id: ID, subjectSlug: 'math', heading: 'Topic', answer: 'Saved text', tags: [], sha: 'a'.repeat(40) };
  const different = { ...same, answer: 'Changed elsewhere' };
  assert.equal(offlineMatchesGitHub(local, same), true);
  assert.equal(classifyVaultOfflineConflict(local, same), 'already-synced');
  assert.equal(classifyVaultOfflineConflict(local, different), 'conflict');
  assert.equal(classifyVaultOfflineConflict(local, null), 'ready');
  const ui = await readFile(new URL('../app/components/vault-offline-queue.js', import.meta.url), 'utf8');
  assert.match(ui, /function keepBoth\(\)/);
  assert.match(ui, /crypto\.randomUUID\(\)/);
  assert.match(ui, /Confirm already saved/);
  assert.match(ui, /Use my offline version/);
  const page = await readFile(new URL('../app/notes/page.js', import.meta.url), 'utf8');
  assert.match(page, /window\.localStorage\.setItem\(key, JSON\.stringify\(\{ draft \}\)\)/);
  assert.match(page, /saveOffline\(\{ allowWhileSaving: true \}\)/);
  assert.match(page, /saveVaultReadCache\(window\.localStorage/);
});
