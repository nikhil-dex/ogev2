import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('LT3 both Notes storage modes share subject playlists without changing Note queries', async () => {
  const notes = await readFile(new URL('../app/notes/page.js', import.meta.url), 'utf8');
  const vault = await readFile(new URL('../app/vault/notes/page.js', import.meta.url), 'utf8');
  const playlists = await readFile(new URL('../app/components/subject-learning-playlists.js', import.meta.url), 'utf8');
  assert.ok(notes.includes('!globalSearch && activeSubject && <SubjectLearningPlaylists subjectSlug={activeSubject}'));
  assert.ok(vault.includes('<NotesPage notesApi="/api/vault/notes-main"'));
  assert.ok(playlists.includes('track.subjectSlug === subjectSlug'));
  assert.ok(playlists.includes("fetch('/api/learning-tracks'"));
  assert.ok(playlists.includes('if (!assigned.length) return null'));
});

test('LT10 playlist filtering uses captured Note identities', async () => {
 const notes = await readFile(new URL('../app/notes/page.js', import.meta.url), 'utf8');
 const capture = await readFile(new URL('../app/api/extension/learning-note/route.js', import.meta.url), 'utf8');
 assert.ok(notes.includes('currentPlaylistFilter.noteIds.includes(String(note.id))'));
 assert.ok(capture.includes('$addToSet: { capturedNotes:'));
});
