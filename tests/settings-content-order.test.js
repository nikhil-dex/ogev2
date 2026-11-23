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

test('retro Settings CSS maintains readable controls in dark mode and small screens', async () => {
  const css = await read('../app/globals.css');
  const scoped = css.slice(css.lastIndexOf('/* Settings contrast/layout fixes:'));
  assert.ok(scoped.length > 1500, 'Settings overrides must be present');
  assert.match(scoped, /\.oge-settings-page\.oge-retro-workspace \.oge-settings-card \.oge-interest-option/);
  assert.match(scoped, /\.oge-home-module-option small/);
  assert.match(scoped, /\.oge-settings-control-row strong/);
  assert.match(scoped, /\.oge-settings-control-row select/);
  assert.match(scoped, /\.oge-settings-segmented button\.is-selected/);
  assert.match(scoped, /scroll-margin-top:24px/);
  assert.match(scoped, /@media\(max-width:850px\)/);
  assert.match(scoped, /@media\(max-width:540px\)/);
  assert.match(scoped, /overscroll-behavior-inline:contain/);
  assert.doesNotMatch(scoped, /!important/);
});
