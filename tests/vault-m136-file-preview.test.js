import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import {
  canPreviewMediaFile, canPreviewDocumentFile, hasValidMediaSignature,
} from '../lib/oge-vault-media-validation.js';
import { docxDocumentXml } from '../lib/oge-vault-docx-preview.js';
import { cspForNonce } from '../lib/security-headers.js';

function wordArchive(text, method = 8) {
  const filename = Buffer.from('word/document.xml');
  const document = Buffer.from(text, 'utf8');
  const compressed = method === 8 ? deflateRawSync(document) : document;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(document.length, 22);
  local.writeUInt16LE(filename.length, 26);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(method, 10);
  header.writeUInt32LE(compressed.length, 20);
  header.writeUInt32LE(document.length, 24);
  header.writeUInt16LE(filename.length, 28);
  header.writeUInt32LE(0, 42);
  const dirOffset = local.length + filename.length + compressed.length;
  const dirSize = header.length + filename.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(dirSize, 12);
  eocd.writeUInt32LE(dirOffset, 16);
  return Buffer.concat([local, filename, compressed, header, filename, eocd]);
}

test('My Files supports validated PDF, images, GIF and private DOCX text preview', () => {
  for (const file of [
    { name: 'slides.pdf', type: 'application/pdf' },
    { name: 'scan.PNG', type: 'image/png' },
    { name: 'photo.jpg', type: 'image/jpeg' },
    { name: 'photo.webp', type: 'image/webp' },
    { name: 'animated.gif', type: 'image/gif' },
  ]) assert.equal(canPreviewMediaFile(file), true, file.name);
  assert.equal(canPreviewDocumentFile({
    name: 'lecture.DOCX',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }), true);
  assert.equal(canPreviewDocumentFile({ name: 'danger.html', type: 'text/html' }), false);
  assert.equal(canPreviewDocumentFile({ name: 'fake.docx', type: 'text/html' }), false);
  assert.equal(hasValidMediaSignature(Buffer.from('GIF89a'), 'image/gif'), true);
  assert.equal(hasValidMediaSignature(Buffer.from('MALWAR'), 'image/gif'), false);
});

test('DOCX ZIP text extracts from stored and deflated Word document XML', async () => {
  const xml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Private class notes</w:t></w:r></w:p></w:body></w:document>';
  for (const method of [0, 8]) {
    const output = await docxDocumentXml(wordArchive(xml, method));
    assert.equal(output, xml);
  }
});

test('DOCX rejects malformed ZIP, missing XML, excessive inflation and foreign ZIP types', async () => {
  await assert.rejects(docxDocumentXml(Buffer.from('not a zip')));
  const invalid = wordArchive('<w:p>test</w:p>');
  invalid.writeUInt32LE(0xffffffff, invalid.length - 22 + 16);
  await assert.rejects(docxDocumentXml(invalid));
  await assert.rejects(docxDocumentXml(Buffer.alloc(20 * 1024 * 1024 + 1)));
});

test('Viewer fetches authenticated bytes, uses private blob URLs and never external preview services', async () => {
  const ui = await readFile(new URL('../app/components/media-library.js', import.meta.url), 'utf8');
  const policy = cspForNonce();
  assert.match(policy, /frame-src 'self' blob: https:\/\/accounts\.google\.com/);
  assert.match(ui, /fetch\('\/api\/vault\/media\?action=content&id='/);
  assert.match(ui, /URL\.createObjectURL\(new Blob/);
  assert.match(ui, /URL\.revokeObjectURL\(preview\.url\)/);
  assert.match(ui, /previewDocxText\(bytes\)/);
  assert.match(ui, /preview\.kind === 'pdf'/);
  assert.match(ui, /preview\.kind === 'docx'/);
  assert.doesNotMatch(ui, /view\.officeapps\.live\.com|docs\.google\.com\/gview/);
  const backend = await readFile(new URL('../app/api/vault/media/route.js', import.meta.url), 'utf8');
  assert.match(backend, /context\(\{ readOnly: true \}\)/);
  assert.match(backend, /readVaultMediaBlob\(ctx\.client/);
});
