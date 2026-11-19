import test from 'node:test';
import assert from 'node:assert/strict';
import { getIndexedCustoms, CUSTOMS_INDEX_COLLECTION } from '../lib/customs-index.js';
import { VaultGitHubError } from '../lib/oge-vault-github.js';

function workspace() {
  const rows = new Map();
  let githubReads = 0;
  const db = { collection(name) {
    assert.equal(name, CUSTOMS_INDEX_COLLECTION);
    return {
      async findOne({ _id }) { return rows.get(_id) ?? null; },
      async updateOne({ _id }, update, options) {
        assert.equal(options.upsert, true);
        rows.set(_id, { _id, ...update.$set });
      },
    };
  } };
  const client = {
    branch: 'main', vault: { repoId: 123 },
    async call(url) {
      assert.equal(url, '/contents/customs?ref=main');
      githubReads += 1;
      return [{ name: 'guide.pdf', path: 'customs/guide.pdf', type: 'file',
        size: 4, sha: 'a'.repeat(40) }];
    },
  };
  return { db, client, rows, get githubReads() { return githubReads; } };
}

test('First open scans GitHub and records filenames only; later opens reuse index', async () => {
  const x = workspace(), now = new Date('2026-11-19T10:00:00.000Z');
  const first = await getIndexedCustoms(x.db, x.client, 'owner1', { now });
  assert.equal(first.source, 'github');
  assert.equal(first.files.length, 1);
  assert.equal(x.githubReads, 1);
  const cached = await getIndexedCustoms(x.db, x.client, 'owner1',
    { now: new Date(now.getTime() + 5000) });
  assert.equal(cached.source, 'index');
  assert.equal(cached.files.length, 1);
  assert.equal(x.githubReads, 1);
  const saved = x.rows.get('owner1:123');
  assert.ok(saved);
  assert.deepEqual(Object.keys(saved).sort(),
    ['_id', 'branch', 'exists', 'files', 'ownerId', 'repoId', 'scannedAt'].sort());
  assert.equal(JSON.stringify(saved).includes('Private HTML'), false);
});

test('Refresh or expiry rescans GitHub, and owners never share indexes', async () => {
  const x = workspace(), now = new Date('2026-11-19T10:00:00.000Z');
  await getIndexedCustoms(x.db, x.client, 'owner1', { now });
  await getIndexedCustoms(x.db, x.client, 'owner1',
    { now: new Date(now.getTime() + 1000), refresh: true });
  await getIndexedCustoms(x.db, x.client, 'owner1',
    { now: new Date(now.getTime() + 61000) });
  await getIndexedCustoms(x.db, x.client, 'owner2',
    { now: new Date(now.getTime() + 1000) });
  assert.equal(x.githubReads, 4);
  assert.equal(x.rows.size, 2);
});

test('Failed GitHub refresh does not create a false empty index', async () => {
  const x = workspace();
  x.client.call = async () => { throw new VaultGitHubError('server-error', 503); };
  await assert.rejects(getIndexedCustoms(x.db, x.client, 'owner1'));
  assert.equal(x.rows.size, 0);
});

test('Changed repository ID or branch invalidates existing file index', async () => {
  const x = workspace(), now = new Date('2026-11-19T10:00:00.000Z');
  await getIndexedCustoms(x.db, x.client, 'owner1', { now });
  x.client.vault.repoId = 456;
  await getIndexedCustoms(x.db, x.client, 'owner1', { now });
  assert.equal(x.githubReads, 2);
  assert.equal(x.rows.size, 2);
  x.client.branch = 'trunk';
  x.client.call = async (url) => {
    assert.equal(url, '/contents/customs?ref=trunk');
    return [];
  };
  const result = await getIndexedCustoms(x.db, x.client, 'owner1', { now });
  assert.equal(result.source, 'github');
});
