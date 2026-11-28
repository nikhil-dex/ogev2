import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Learning Tracks stays hidden until a successful server list request', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.match(script, /const LEARNING_TRACKS_EXTENSION_PREVIEW = true;/);
  assert.match(script, /data-tool="tracks" type="button" hidden/);
  assert.match(script, /await send\('LIST_LEARNING_TRACKS'\)/);
  assert.match(script, /tab\.hidden = false/);
  assert.match(script, /tab\.hidden = true/);
  assert.match(script, /\.\.\.\(LEARNING_TRACKS_EXTENSION_PREVIEW \? \[/);
  assert.match(script, /LEARNING_TRACKS_EXTENSION_PREVIEW \? '<button data-tool="tracks"/);
  assert.match(script, /if \(LEARNING_TRACKS_EXTENSION_PREVIEW\) \{/);
  assert.match(script, /tracks-enabled/);
  assert.match(script, /data-tool="note"/);
  assert.match(script, /data-tool="links"/);
  assert.match(script, /send\('SAVE_CURRENT_TAB'\)/);
  assert.match(script, /send\('CREATE_VAULT_NOTE'/);
  const server = await readFile(new URL('../app/api/extension/learning-track/route.js', import.meta.url), 'utf8');
  assert.match(server, /OGE_LEARNING_TRACKS_PREVIEW !== 'true'/);
});

test('M124 legacy extension remains functional with two tabs', async () => {
  const script = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.match(script, /panel\.querySelectorAll\('\[data-tool\]'\)/);
  assert.match(script, /setPanel\(button\.dataset\.tool\)/);
  assert.match(script, /const urlSave = panel\.querySelector\('\[data-save-url\]'\)/);
  assert.match(script, /const noteSave = panel\.querySelector\('\[data-save-note\]'\)/);
});

test('Extension track listing is owner-scoped and uses the connected server', async () => {
  const server = await readFile(new URL('../app/api/extension/learning-track/route.js', import.meta.url), 'utf8');
  const get = server.slice(server.indexOf('export async function GET'));
  assert.match(get, /extensionTokenExpiresAt/);
  assert.match(get, /find\(\{ ownerId: user.googleSub \}\)/);
  assert.match(get, /limit\(100\)/);
  const worker = await readFile(new URL('../extension/service-worker.js', import.meta.url), 'utf8');
  assert.match(worker, /LIST_LEARNING_TRACKS/);
  assert.match(worker, /apiRequest\('\/api\/extension\/learning-track'\)/);
});
