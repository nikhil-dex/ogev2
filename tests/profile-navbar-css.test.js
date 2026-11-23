import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Profile navbar uses scoped full-width and retro contrast overrides', async () => {
  const profile = await read('../app/profile/page.js');
  const css = await read('../public/style.css');
  assert.match(profile, /oge-profile-page oge-retro-workspace/);
  assert.match(profile, /<SiteNavbar actions=\{<Link className="oge-signin" href="\/settings"/);
  const scoped = css.slice(css.lastIndexOf('/* Profile-only navbar:'));
  assert.match(scoped, /\.oge-profile-page \.site-navbar\{/);
  assert.match(scoped, /width:100%/);
  assert.match(scoped, /max-width:100%/);
  assert.match(scoped, /margin-left:0/);
  assert.match(scoped, /\.oge-profile-page \.site-navbar-link\.is-active/);
  assert.match(scoped, /\.oge-profile-page \.site-navbar-actions \.oge-signin/);
  assert.match(scoped, /@media\(max-width:1200px\)/);
  assert.match(scoped, /@media\(max-width:520px\)/);
  assert.doesNotMatch(scoped, /!important/);
});
