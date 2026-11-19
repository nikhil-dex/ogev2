import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildGeminiCleanupPrompt } from '../lib/oge-gemini-cleanup-prompt.js';
import { geminiDraftSnapshot, isGeminiSuggestionCurrent } from '../lib/oge-gemini-review.js';

const draft = {
  heading: 'Sorting', answer: 'Its O(nlogn). See [[Binary Search]].\n\n### 📌 Imp Notes\n- Old',
  tagsText: 'algorithms, sorting', activeSubject: 'subject-a',
  editingId: '', newDraftId: '11111111-1111-4111-8111-111111111111',
};

test('Gemini cleanup prompt matches OgeNotes study requirements without inventing facts', () => {
  const text = buildGeminiCleanupPrompt({
    heading: draft.heading, answer: draft.answer, tags: ['sorting'],
  });
  assert.match(text, /correct clear mistakes/i);
  assert.match(text, /syntax errors, missing imports/);
  assert.match(text, /algorithms, data flow/);
  assert.match(text, /formulas, equations, URLs/);
  assert.match(text, /\[\[Exact note heading\]\]/);
  assert.match(text, /do not guess/i);
  assert.match(text, /Do not invent facts/);
  assert.match(text, /### 📌 Imp Notes/);
  assert.match(text, /2–5 concise/);
  assert.match(text, /REPLACE it rather than appending a second one/);
  assert.match(text, /at most 10 useful/);
  assert.match(text, /untrusted DATA/);
  assert.ok(text.includes(draft.answer));
  assert.ok(text.includes(JSON.stringify(['sorting'])));
});

test('Gemini suggestions become stale after any heading/content/tag or Note switch', () => {
  const original = geminiDraftSnapshot(draft);
  assert.equal(isGeminiSuggestionCurrent(original, draft), true);
  for (const field of ['heading', 'answer', 'tagsText', 'activeSubject', 'editingId', 'newDraftId']) {
    assert.equal(isGeminiSuggestionCurrent(original, {
      ...draft, [field]: draft[field] + '-new',
    }), false, field);
  }
  assert.equal(isGeminiSuggestionCurrent(null, draft), false);
  assert.equal(isGeminiSuggestionCurrent(original, null), false);
});

test('Notes API accepts authenticated unsaved drafts without bypassing saved-Note ownership checks', async () => {
  const route = await readFile(new URL('../app/api/notes/cleanup/route.js', import.meta.url), 'utf8');
  assert.match(route, /const ownerId = session\?\.user\?\.id/);
  assert.match(route, /if \(!ownerId\).*401/);
  assert.match(route, /const isUnsavedDraft = !id/);
  assert.match(route, /if \(!isUnsavedDraft && !vaultNoteId && !ObjectId\.isValid\(id\)\)/);
  assert.match(route, /if \(vaultNoteId\)/);
  assert.match(route, /readVaultNote\(client, id\.toLowerCase\(\)\)/);
  assert.match(route, /else if \(!isUnsavedDraft\)/);
  assert.match(route, /ownerMutationFilter\(ownerId/);
  assert.match(route, /buildGeminiCleanupPrompt\(\{ heading, answer, tags \}\)/);
  assert.match(route, /applied: false/);
  assert.doesNotMatch(route, /collection\('notes'\)\.updateOne/);
});

test('Notes editor holds Gemini suggestions for explicit Apply or Cancel in both editor layouts', async () => {
  const page = await readFile(new URL('../app/notes/page.js', import.meta.url), 'utf8');
  const component = await readFile(new URL('../app/components/gemini-note-review.js', import.meta.url), 'utf8');
  assert.match(page, /const \[geminiSuggestion, setGeminiSuggestion\] = useState\(null\)/);
  assert.match(page, /if \(aiCleanupBusy \|\| saving \|\| \(hybridDrafts && !hybridReady\)\) return/);
  assert.match(page, /\.\.\.\(editingId \? \{ id: editingId \} : \{\}\)/);
  assert.match(page, /isGeminiSuggestionCurrent\(original, liveEditorRef\.current\)/);
  assert.match(page, /isGeminiSuggestionCurrent\(geminiSuggestion\.original, currentGeminiDraft\)/);
  assert.match(page, /setGeminiSuggestion\(\{[\s\S]*?original,[\s\S]*?suggested:/);
  assert.equal((page.match(/<GeminiNoteReview suggestion=/g) || []).length, 2);
  assert.match(component, /Original draft/);
  assert.match(component, /Gemini suggestion/);
  assert.match(component, /Cancel suggestion/);
  assert.match(component, /Apply to draft/);
  assert.match(component, /disabled=\{stale\}/);
  assert.match(page, /setDraftStatus\('Gemini suggestion applied to draft — press Save to commit'\)/);
  assert.doesNotMatch(page, /setHeading\(result\.heading\)/);
  assert.doesNotMatch(page, /setAnswer\(result\.answer\)/);
});

test('cleanup is offered for newly created Notes and discarded on editor switch/close', async () => {
  const page = await readFile(new URL('../app/notes/page.js', import.meta.url), 'utf8');
  assert.equal((page.match(/onClick=\{cleanupWithGemini\}/g) || []).length, 2);
  assert.doesNotMatch(page, /\{editingId && <button type="button" className="answer-expand-button oge-gemini-cleanup-button"/);
  assert.match(page, /function openNewNote\([\s\S]*?cancelGeminiReview\(\)/);
  assert.match(page, /function editNote\(note\) \{\s*cancelGeminiReview\(\)/);
  assert.match(page, /function closeNoteEditor\(\)[\s\S]*?cancelGeminiReview\(\)/);
  assert.match(page, /geminiRequestRef\.current\?\.abort\(\)/);
});
