import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { listCustomsFiles } from '../lib/customs-library.js';

test('Customs stays hidden without the optional folder', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'oge-customs-'));
  try {
    assert.deepEqual(await listCustomsFiles(root), { exists: false, files: [] });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Customs discovers HTML, PDFs and images with safe asset links', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'oge-customs-'));
  try {
    const folder = path.join(root, 'public', 'customs');
    await mkdir(folder, { recursive: true });
    for (const name of ['ml_notes.html', 'Java Basics.PDF', 'network chart.png', 'photo.JPG',
      'demo.webp', 'skip.js', 'skip.txt']) {
      await writeFile(path.join(folder, name), 'example');
    }
    await mkdir(path.join(folder, 'subfolder'));
    const { exists, files } = await listCustomsFiles(root);
    assert.equal(exists, true);
    assert.equal(files.length, 5);
    assert.deepEqual([...new Set(files.map((file) => file.type))].sort(), ['HTML', 'Image', 'PDF']);
    assert.ok(files.some((file) => file.url === '/customs/network%20chart.png'));
    assert.ok(files.some((file) => file.name === 'ml_notes.html' && file.title === 'ml notes'));
    assert.ok(files.every((file) => !file.name.startsWith('skip')));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Homepage only renders Customs when the directory exists', async () => {
  const source = await readFile(new URL('../app/page.js', import.meta.url), 'utf8');
  assert.match(source, /await listCustomsFiles\(\)/);
  assert.match(source, /\{customs\.exists && \(/);
  assert.match(source, /customs\.files\.map/);
  assert.match(source, /href=\{file\.url\}/);
});
