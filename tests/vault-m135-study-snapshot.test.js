import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  appendStudyDueNotes, removeReviewedStudyNote, skipStudyNote,
} from '../lib/oge-vault-study-queue.js';

const card = (id, due = true) => ({ id, heading: 'Note ' + id, answer: 'Answer', due });

test('Scanning further GitHub pages appends due notes without losing earlier cards', () => {
  const first = appendStudyDueNotes([], [card('one'), card('two', false)]);
  const next = appendStudyDueNotes(first, [card('one'), card('three'), card('four', false)]);
  assert.deepEqual(next.map((note) => note.id), ['one', 'three']);
  assert.deepEqual(first.map((note) => note.id), ['one']);
  assert.deepEqual(removeReviewedStudyNote(next, 'one').map((note) => note.id), ['three']);
});

test('Skipping changes the displayed card without marking it as reviewed', () => {
  const queue = [card('one'), card('two'), card('three')];
  assert.deepEqual(skipStudyNote(queue).map((note) => note.id), ['two', 'three', 'one']);
  assert.deepEqual(queue.map((note) => note.id), ['one', 'two', 'three']);
  assert.deepEqual(skipStudyNote([card('one')]).map((note) => note.id), ['one']);
  assert.throws(() => appendStudyDueNotes([], [null]));
});

test('Study UI preserves queue, shows scan progress, and acknowledges review only after Save', async () => {
  const source = await readFile(new URL('../app/vault/study/study-client.js', import.meta.url), 'utf8');
  assert.match(source, /next \? appendStudyDueNotes\(existing, page\.notes\)/);
  assert.match(source, /removeReviewedStudyNote\(items, note\.id\)/);
  assert.match(source, /setCompleted\(\(n\) => n \+ 1\)/);
  assert.match(source, /skipStudyNote\(items\)/);
  assert.match(source, /Scan next 20 Notes/);
});

test('Offline read-only mode blocks opening create and edit dialogs until reconnect', async () => {
  const source = await readFile(new URL('../app/notes/page.js', import.meta.url), 'utf8');
  assert.match(source, /function openNewNote\([\s\S]*?if \(offlineReadOnly\)/);
  assert.match(source, /function editNote\([\s\S]*?if \(offlineReadOnly\)/);
  assert.match(source, /if \(offlineReadOnly\) \{ setError\('Reconnect and refresh Notes before saving/);
});

test('Snapshot ZIP route binds committed SHA to signed-in owner and fails if branch changed', async () => {
  const route = await readFile(new URL('../app/api/vault/backup-snapshot/route.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../app/vault/backup/backup-coverage.js', import.meta.url), 'utf8');
  assert.match(route, /await auth\(\)/);
  assert.match(route, /ownerMutationFilter\(ownerId, \{ sessionVersion \}\)/);
  assert.match(route, /account\?\.notesStorage !== 'github'/);
  assert.match(route, /getVaultNoteClient\(db, \{ ownerId, sessionVersion \}, \{ readOnly: true \}\)/);
  assert.match(route, /ref\?\.object\?\.sha\?\.toLowerCase\(\) !== expected\.toLowerCase\(\)/);
  assert.match(route, /'\/archive\/' \+ expected\.toLowerCase\(\) \+ '\.zip'/);
  assert.match(ui, /backup-snapshot\?commit=/);
  assert.match(ui, /data\.commitSha/);
});
