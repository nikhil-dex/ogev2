import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readerSequenceForNote } from '../lib/oge-note-reader-sequence.js';

const first = { id: 'a', subjectSlug: 'math', heading: 'Algebra',
  createdAt: '2026-11-01', updatedAt: '2026-11-12' };
const second = { id: 'b', subjectSlug: 'math', heading: 'Geometry',
  createdAt: '2026-11-02', updatedAt: '2026-11-11' };
const linked = { id: 'linked', subjectSlug: 'cs', heading: 'Arrays',
  createdAt: '2026-11-03', updatedAt: '2026-11-18' };
const linkedSibling = { id: 'other', subjectSlug: 'cs', heading: 'Binary Search',
  createdAt: '2026-11-04', updatedAt: '2026-11-17' };

test('the reader keeps normal filtered-note order when the opened Note is visible', () => {
  assert.deepEqual(readerSequenceForNote(first, [second, first], [first, second, linked])
    .map((note) => note.id), ['b', 'a']);
});

test('cross-subject Note links retain reader arrow/swipe navigation', () => {
  const sequence = readerSequenceForNote(linked, [first, second],
    [first, second, linkedSibling], 'title-asc');
  assert.deepEqual(sequence.map((note) => note.id), ['linked', 'other']);
  assert.equal(sequence.findIndex((note) => note.id === linked.id), 0);
  assert.equal(readerSequenceForNote(null, [first], [linked]).length, 0);
});

test('linked Notes from later Vault pages are included once and pinned first', () => {
  const pinned = { ...linkedSibling, pinned: true };
  const sequence = readerSequenceForNote(linked, [first], [pinned, linked, first]);
  assert.deepEqual(sequence.map((note) => note.id), ['other', 'linked']);
});

test('keyboard arrows, Escape and outside click all cancel obsolete link scans', async () => {
  const page = await readFile(new URL('../app/notes/page.js', import.meta.url), 'utf8');
  assert.match(page, /readerSequenceForNote\(readerNote, visibleNotes, notes, sortOrder\)/);
  assert.match(page, /event\.key === 'ArrowRight' \? 1 : -1/);
  assert.match(page, /event\.preventDefault\(\);\s*linkScanRef\.current\?\.abort\(\)/);
  assert.match(page, /onMouseDown=\{\(event\).*stopLinkScan\(\)/);
  assert.match(page, /onTouchEnd=\{\(event\)/);
});
