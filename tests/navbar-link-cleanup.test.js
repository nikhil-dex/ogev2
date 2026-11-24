import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(new URL(p, import.meta.url), 'utf8');

test('shared navbar avoids duplicate home and files links', async () => {
  const navbar = await read('../app/components/site-navbar.js');
  const home = await read('../app/page.js');
  assert.match(navbar, /className="brand" href="\/"/);
  assert.doesNotMatch(navbar, /\{ href: '\/', label: 'Home' \}/);
  assert.doesNotMatch(navbar, /href: '\/files', label: 'My Files'/);
  assert.match(navbar, /\{ href: '\/notes', label: 'Notes' \}/);
  assert.match(navbar, /\{ href: '\/profile', label: 'Profile' \}/);
  assert.match(navbar, /link.href !== '\/news' \|\| newsEnabled/);
  assert.match(navbar, /notesHref = '\/notes'/);
  assert.match(home, /href: '\/files'/);
  assert.match(home, /<SiteNavbar notesHref=\{notesHref\} showNews=\{showNews\}/);
});
