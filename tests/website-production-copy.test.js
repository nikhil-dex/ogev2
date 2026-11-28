import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('public website fields use general-purpose placeholders', async () => {
  const expected = {
  "app/notes/page.js": [
    "Enter a note title",
    "e.g. reference, review, important",
    "Write your note here…"
  ],
  "app/saved-links/page.js": [
    "Enter a link title",
    "Paste a website URL",
    "e.g. Work, Learning, Personal",
    "e.g. reference, useful, reading"
  ],
  "app/settings/settings-client.js": [
    "Enter a subject name"
  ],
  "app/profile/page.js": [
    "Choose a username",
    "Your GitHub profile URL",
    "Your LinkedIn profile URL",
    "Your website or portfolio URL"
  ],
  "app/register/password-sign-in.js": [
    "Enter your email address"
  ],
  "app/vault/capture/vault-quick-capture-client.js": [
    "Enter a subject name"
  ]
};
  for (const [path, placeholders] of Object.entries(expected)) {
    const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
    for (const placeholder of placeholders) assert.ok(source.includes('placeholder="' + placeholder + '"'), path + ': ' + placeholder);
    assert.doesNotMatch(source, /placeholder="[^"]*(?:localhost|Machine Learning|Computer Networks|chmod|React documentation|student@example\.com)[^"]*"/i);
  }
});
