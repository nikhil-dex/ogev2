import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('extension shows subject Notes selector, initial five titles and Show more', async () => {
  const content = await read('../extension/content.js');
  const worker = await read('../extension/service-worker.js');
  const proxy = await read('../proxy.js');
  assert.match(content, /id="oge-target-note"/);
  assert.match(content, /Default \(new Note\)/);
  assert.match(content, /data-show-more-notes/);
  assert.match(content, /'GET_NOTES_FOR_SUBJECT'/);
  assert.match(content, /'APPEND_TO_NOTE'/);
  assert.match(content, /Append to ' \+ selected.heading/);
  assert.match(content, /noteMore.hidden = result.hasMore !== true/);
  assert.match(content, /const offset = listedNotes.size/);
  assert.match(content, /request !== notePickerRequest/);
  assert.match(worker, /'GET_NOTES_FOR_SUBJECT'/);
  assert.match(worker, /'APPEND_TO_NOTE'/);
  assert.match(worker, /\/api\/extension\/notes/);
  assert.match(proxy, /pathname === '\/api\/extension\/notes'/);
});

test('extension picker route lists only signed token owners subject and appends optimistically', async () => {
  const route = await read('../app/api/extension/notes/route.js');
  assert.match(route, /hashExtensionToken\(token\)/);
  assert.match(route, /extensionTokenExpiresAt: \{ \$gt: new Date\(\) \}/);
  assert.match(route, /ownerId: ctx.owner.googleSub, subjectSlug: subject/);
  assert.match(route, /listVaultNotePage\(client, \{ cursor, limit: 25 \}\)/);
  assert.match(route, /\.sort\(\{ updatedAt: -1, createdAt: -1 \}\)/);
  assert.match(route, /\.skip\(offset\)\.limit\(6\)/);
  assert.match(route, /notes: slice.slice\(0, 5\)/);
  assert.match(route, /answer = previous.answer \+ '\\n\\n' \+ content/);
  assert.match(route, /previous.sha !== version/);
  assert.match(route, /previous.updatedAt/);
  assert.match(route, /withVaultSubjectWrite/);
  assert.match(route, /withActiveOwnerMutation/);
  assert.match(route, /confirmed: true/);
  assert.doesNotMatch(route, /collection\('notes'\)\.insertOne/);
});

test('choosing an existing Note appends, preserves typed text on failure and does not create another', async () => {
  const src = await read('../extension/content.js');
  const from = src.indexOf('  function updateNoteButton() {');
  const to = src.indexOf('  const urlSave = ', from);
  assert.ok(from > 0 && to > from);
  const id = randomUUID();
  const subject = randomUUID();
  let save;
  const calls = [];
  const note = { value: 'Additional learning points' };
  const noteSelect = { value: id };
  const ctx = {
    note, subjectSelect: { value: subject, addEventListener() {} },
    noteSelect, listedNotes: new Map([[id, { id, heading: 'ML P2', version: 'a'.repeat(40) }]]),
    noteSave: { disabled: false, addEventListener: (name, fn) => { if (name === 'click') save = fn; } },
    noteNewCapture: { hidden: true, addEventListener() {} },
    noteOpenSaved: { hidden: true },
    vaultReady: true, pendingSavedUpdate: null, pendingVaultCapture: null,
    savingCapture: false, lastSavedVaultNoteId: null,
    createCaptureId: randomUUID, loadNotes: async () => {},
    setStatus: (msg) => { ctx.message = msg; },
    send: async (type, payload) => {
      calls.push({ type, payload });
      if (calls.length === 1) throw Error('Connection interrupted');
      return { confirmed: true, id, title: 'ML P2', version: 'b'.repeat(40) };
    },
  };
  vm.runInNewContext(src.slice(from, to), ctx, { timeout: 1500 });
  await save();
  assert.match(ctx.noteSave.textContent, /Append to ML P2/);
  assert.equal(note.value, 'Additional learning points');
  assert.match(ctx.message, /still in the editor/);
  await save();
  assert.equal(note.value, '');
  assert.match(ctx.message, /Appended to/);
  assert.deepEqual(calls.map((c) => c.type), ['APPEND_TO_NOTE', 'APPEND_TO_NOTE']);
  assert.equal(calls[1].payload.version, 'a'.repeat(40));
  assert.equal(calls[1].payload.content, 'Additional learning points');
});
