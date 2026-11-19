import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validatedNote } from '../lib/oge-vault-notes.js';
import { noteLinkTitles, relatedNoteLinks } from '../lib/oge-note-links.js';
import { readDailyStudy, finishDailyStudyReview, saveDailyStudy } from '../lib/oge-vault-study-goal.js';
import { annotateVaultStudyPage, recordVaultReview } from '../lib/oge-vault-study.js';

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SUBJECT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('pinned flag preserves historical GitHub Note shape until a Note is pinned', () => {
  const input = { heading: 'Algebra', answer: 'Notes', subjectId: SUBJECT, tags: [], favorite: false };
  const original = validatedNote(input, { id: ID, now: '2026-11-19T00:00:00Z' });
  assert.equal(Object.hasOwn(original, 'pinned'), false);
  const pinned = validatedNote({ ...input, pinned: true }, {
    id: ID, now: '2026-11-19T00:00:00Z',
  });
  assert.equal(pinned.pinned, true);
  assert.throws(() => validatedNote({ ...input, pinned: 'yes' }, { id: ID }));
  assert.equal(Object.hasOwn(validatedNote({ ...input, pinned: false }, { id: ID }), 'pinned'), false);
});

test('wiki-note links and backlinks are title matched within one subject', () => {
  const notes = [
    { id: '1', subjectSlug: SUBJECT, heading: 'Binary Search', answer: 'See [[ Trees ]] and [[sorting]]' },
    { id: '2', subjectSlug: SUBJECT, heading: 'Trees', answer: 'See [[ Binary Search ]]' },
    { id: '3', subjectSlug: SUBJECT, heading: 'Sorting', answer: 'Related' },
    { id: '4', subjectSlug: 'another', heading: 'Trees', answer: 'Unrelated' },
  ];
  assert.deepEqual(noteLinkTitles('[[ Trees ]] and [[TREES]] and [[sorting]]'), ['trees', 'sorting']);
  const related = relatedNoteLinks(notes[0], notes);
  assert.deepEqual(related.outgoing.map((note) => note.id), ['2', '3']);
  assert.deepEqual(related.backlinks.map((note) => note.id), ['2']);
  assert.deepEqual(relatedNoteLinks(null, notes), { outgoing: [], backlinks: [] });
});

test('daily study goal resets on next day and counts only completed reviews', () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const key = 'daily-study-test';
  const today = new Date(2026, 10, 19, 8, 30);
  const tomorrow = new Date(2026, 10, 20, 8, 30);
  assert.equal(readDailyStudy(storage, key, today).goal, 10);
  saveDailyStudy(storage, key, { goal: 15, completed: 0, date: '2026-11-19' });
  assert.equal(finishDailyStudyReview(storage, key, today).completed, 1);
  assert.deepEqual(readDailyStudy(storage, key, tomorrow), {
    goal: 15, completed: 0, date: '2026-11-20',
  });
});

test('learned state is metadata only and maps to good or easy recall', async () => {
  const calls = [];
  const rows = [{ noteId: ID, rating: 'easy', dueAt: new Date('2026-11-18'), reviewCount: 4 }];
  const db = { collection: () => ({
    updateOne: async (...args) => { calls.push(args); },
    find: () => ({ toArray: async () => rows }),
  }) };
  const client = { vault: { repoId: 123 } };
  const note = { id: ID, heading: 'Private heading', answer: 'Secret answer', subjectId: SUBJECT };
  const review = await recordVaultReview(db, client, 'owner', note, 'good');
  assert.equal(review.learned, true);
  assert.ok(!JSON.stringify(calls).includes('Secret answer'));
  const [marked] = await annotateVaultStudyPage(db, client, 'owner', [note]);
  assert.equal(marked.learned, true);
  assert.equal(marked.reviewCount, 4);
});

test('Notes reader navigates with keyboard arrows without interfering with typing', async () => {
  const ui = await read('../app/notes/page.js');
  assert.match(ui, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowRight'/);
  assert.match(ui, /!readerNote \|\| noteDialog \|\| event\.defaultPrevented \|\| event\.repeat/);
  assert.match(ui, /event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey \|\| event\.shiftKey/);
  assert.match(ui, /target\.closest\('input, textarea, select, \[contenteditable\], \[role="textbox"\]'\)/);
  assert.match(ui, /event\.key === 'ArrowRight' \? 1 : -1/);
  assert.match(ui, /const next = readerSequence\[readerIndex \+ step\]/);
  assert.match(ui, /if \(!next\) return;\s*event\.preventDefault\(\);\s*setReaderNote\(next\)/);
  assert.match(ui, /Use ← and → keyboard arrows to browse Notes/);
});

test('Notes interface wires all six parity improvements to existing APIs', async () => {
  const ui = await read('../app/notes/page.js');
  const vault = await read('../app/api/vault/notes-main/route.js');
  const mongo = await read('../app/api/notes/route.js');
  const gemini = await read('../app/api/notes/cleanup/route.js');
  const study = await read('../app/vault/study/study-client.js');
  const pdf = await read('../lib/oge-note-pdf.js');
  assert.match(ui, /togglePinned\(note\)/);
  assert.match(ui, /📌 Pinned/);
  assert.match(ui, /readerLinks\.outgoing/);
  assert.match(ui, /readerLinks\.backlinks/);
  assert.match(ui, /moveReaderNote\(dx < 0 \? 1 : -1\)/);
  assert.match(ui, /Save PDF to My Files/);
  assert.match(ui, /saveNotePdfToVault\(pdf\)/);
  assert.match(ui, /Recovered unsaved browser draft/);
  assert.match(ui, /const freshId = vaultMode \? crypto\.randomUUID\(\) : ''/);
  assert.match(vault, /pinned: typeof data\.pinned === 'boolean'/);
  assert.match(mongo, /pinned: Boolean\(note\.pinned\)/);
  assert.match(gemini, /getVaultNoteClient\(db/);
  assert.match(gemini, /readVaultNote\(client/);
  assert.match(study, /finishDailyStudyReview/);
  assert.match(study, /LEARNED NOTES/);
  assert.match(pdf, /\/api\/vault\/media\?action=upload-chunk/);
  assert.match(pdf, /\/api\/vault\/media'/);
});
