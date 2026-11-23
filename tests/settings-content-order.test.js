import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Settings navigation is ordered to match actual sections', async () => {
  const src = await read('../app/settings/page.js');
  const sidebar = src.slice(src.indexOf('<aside className="oge-settings-sidebar"'),src.indexOf('</aside>'));
  const ids = ['homepage-modules', 'news-preferences', 'appearance', 'pixel-strip', 'organization', 'gemini-ai', 'vault-connection', 'data', 'account-deletion'];
  let last = -1;
  for (const id of ids) {
    const index = sidebar.indexOf('#' + id);
    assert.ok(index > last, 'sidebar section order: ' + id);
    last = index;
  }
  for (const id of ['homepage-modules', 'news-preferences', 'vault-connection'])
    assert.equal((src.match(new RegExp('id="' + id + '"','g')) || []).length, 1);
});

test('Settings sections render in the intended sequence without duplicate client state', async () => {
  const page = await read('../app/settings/page.js');
  const client = await read('../app/settings/settings-client.js');
  const order = ['{preferences}', 'id="appearance"', 'id="pixel-strip"', 'id="organization"', 'id="gemini-ai"', '{storage}', 'id="data"', 'id="account-deletion"'];
  let last = -1;
  for (const marker of order) {
    const index = client.indexOf(marker);
    assert.ok(index > last, 'rendered Settings content order: ' + marker);
    last = index;
  }
  assert.equal((page.match(/<SettingsClient/g) || []).length, 1);
  assert.match(page, /preferences=\{<>/);
  assert.match(page, /storage=\{<>/);
  assert.ok(page.indexOf('id="homepage-modules"') < page.indexOf('id="news-preferences"'));
  assert.match(client, /accountDeletionEnabled &&/);
  assert.match(page, /OGE_ACCOUNT_DELETION_ENABLED === 'true' && <a href="#account-deletion">/);
});
