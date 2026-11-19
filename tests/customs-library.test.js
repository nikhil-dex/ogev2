import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  listVaultCustoms, readVaultCustomFile, customFileType, customFileLink,
} from '../lib/customs-library.js';
import { VaultGitHubError } from '../lib/oge-vault-github.js';

const SHA = 'a'.repeat(40);
function fakeClient({ missing = false, files = null } = {}) {
  const bytes = Buffer.from('<h1>Private HTML</h1>', 'utf8');
  const entries = files ?? [{
    type: 'file', path: 'customs/my notes.html', name: 'my notes.html',
    size: bytes.length, sha: SHA,
  }, {
    type: 'file', path: 'customs/study.pdf', name: 'study.pdf', size: 50, sha: 'b'.repeat(40),
  }, {
    type: 'file', path: 'customs/photo.PNG', name: 'photo.PNG', size: 50, sha: 'c'.repeat(40),
  }, {
    type: 'file', path: 'customs/skip.js', name: 'skip.js', size: 10, sha: 'd'.repeat(40),
  }];
  const calls = [];
  return {
    branch: 'main',
    calls,
    async call(path) {
      calls.push(path);
      if (path === '/contents/customs?ref=main') {
        if (missing) throw new VaultGitHubError('not-found', 404);
        return entries;
      }
      if (path === '/git/blobs/' + SHA) {
        return { sha: SHA, encoding: 'base64', content: bytes.toString('base64') };
      }
      throw new Error('Unexpected GitHub API path: ' + path);
    },
  };
}

test('Customs is hidden when the signed-in user Vault has no customs folder', async () => {
  assert.deepEqual(await listVaultCustoms(fakeClient({ missing: true })),
    { exists: false, files: [] });
});

test('Customs lists only supported top-level private Vault files', async () => {
  const client = fakeClient();
  const result = await listVaultCustoms(client);
  assert.equal(result.exists, true);
  assert.equal(result.files.length, 3);
  assert.ok(result.files.some((file) => file.name === 'my notes.html' &&
    file.url === '/api/vault/customs?file=my%20notes.html' && file.type === 'html'));
  assert.ok(result.files.some((file) => file.type === 'pdf'));
  assert.ok(result.files.some((file) => file.type === 'image'));
  assert.equal(result.files.some((file) => file.name === 'skip.js'), false);
  assert.deepEqual(client.calls, ['/contents/customs?ref=main']);
});

test('Customs extension mapping recognizes user files case-insensitively', () => {
  for (const [filename, kind, mime] of [
    ['notes.HTML', 'html', 'text/html'],
    ['study.pdf', 'pdf', 'application/pdf'],
    ['diagram.PNG', 'image', 'image/png'],
    ['photo.jpeg', 'image', 'image/jpeg'],
  ]) assert.deepEqual(customFileType(filename), { kind, mime });
});

test('Customs rejects unsupported paths and oversized files', async () => {
  assert.equal(customFileType('../secret.html'), null);
  assert.equal(customFileType('file.js'), null);
  assert.throws(() => customFileLink('secret/notes.html'));
  assert.deepEqual(await listVaultCustoms(fakeClient({ files: [{
    type: 'file', path: 'customs/big.pdf', name: 'big.pdf',
    size: 11 * 1024 * 1024, sha: SHA,
  }] })), { exists: true, files: [] });
});

test('Opening a Custom HTML file reads immutable blob bytes', async () => {
  const client = fakeClient();
  const result = await readVaultCustomFile(client, 'my notes.html');
  assert.equal(result.mime, 'text/html');
  assert.equal(result.bytes.toString(), '<h1>Private HTML</h1>');
  assert.ok(client.calls.includes('/git/blobs/' + SHA));
  await assert.rejects(readVaultCustomFile(client, 'no.html'));
});

test('Home always links to dedicated Customs indexing page', async () => {
  const home = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('../app/customs/page.js', import.meta.url), 'utf8');
  const route = await readFile(new URL('../app/api/vault/customs/route.js', import.meta.url), 'utf8');
  assert.match(home, /title: 'Customs'/);
  assert.match(home, /account\.notesStorage === 'github' && filesReady/);
  assert.match(home, /href: '\/customs'/);
  assert.doesNotMatch(home, /await listVaultCustoms\(client\)/);
  assert.match(page, /await getIndexedCustoms\(db, client, ownerId,/);
  assert.match(page, /account\.notesStorage !== 'github'\) redirect\('\/'\)/);
  assert.match(page, /refresh: params\?\.refresh === 'true'/);
  assert.match(page, /Connect your GitHub Vault first/);
  assert.match(page, /href="\/customs\?refresh=true"/);
  assert.match(route, /ownerMutationFilter\(ownerId, \{ sessionVersion \}\)/);
  assert.match(route, /connectedVaultStorageAvailable\(account\)/);
  assert.match(route, /account\.notesStorage !== 'github'/);
  assert.match(route, /getVaultNoteClient\(db, \{ ownerId, sessionVersion \}, \{ readOnly: true \}\)/);
  assert.match(route, /getIndexedCustoms\(db, client, ownerId, \{ refresh \}\)/);
  assert.match(route, /Content-Security-Policy/);
  assert.match(route, /sandbox allow-scripts/);
});
