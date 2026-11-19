// Read-only, browser-local DOCX text extraction. Never uploads a user's
// private document to Office Online, Google Docs or an external converter.
// This intentionally previews document text (not Word's complete layout).
const MAX_DOCX_BYTES = 20 * 1024 * 1024;
const MAX_XML_BYTES = 5 * 1024 * 1024;
const MAX_ENTRIES = 3000;
const decoder = new TextDecoder('utf-8', { fatal: true });
const invalid = () => new Error('This Word document could not be previewed. Download it to open in Word.');

export async function docxDocumentXml(input) {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!data.length || data.byteLength > MAX_DOCX_BYTES) throw invalid();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (i) => view.getUint16(i, true);
  const u32 = (i) => view.getUint32(i, true);
  // ZIP end-of-central-directory can be followed by up to 65,535 comment bytes.
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === data.length) {
      end = i; break;
    }
  }
  if (end < 0) throw invalid();
  const entries = u16(end + 10), tableSize = u32(end + 12), tableOffset = u32(end + 16);
  if (!entries || entries > MAX_ENTRIES || tableOffset + tableSize > end ||
      u16(end + 8) !== entries || u16(end + 4) !== 0 || u16(end + 6) !== 0) throw invalid();
  let offset = tableOffset, document = null;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) throw invalid();
    const method = u16(offset + 10), compressed = u32(offset + 20);
    const expanded = u32(offset + 24), nameLength = u16(offset + 28);
    const extraLength = u16(offset + 30), commentLength = u16(offset + 32);
    const localOffset = u32(offset + 42);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > end) throw invalid();
    const name = decoder.decode(data.subarray(offset + 46, offset + 46 + nameLength));
    if (name === 'word/document.xml') {
      if (document || expanded < 1 || expanded > MAX_XML_BYTES ||
          compressed > MAX_DOCX_BYTES || (method !== 0 && method !== 8) ||
          localOffset + 30 > data.length || u32(localOffset) !== 0x04034b50)
        throw invalid();
      const start = localOffset + 30 + u16(localOffset + 26) + u16(localOffset + 28);
      if (start + compressed > data.length) throw invalid();
      document = { compressed: data.subarray(start, start + compressed), expanded, method };
    }
    offset = next;
  }
  if (offset !== tableOffset + tableSize || !document) throw invalid();
  let bytes;
  if (document.method === 0) {
    bytes = document.compressed;
  } else {
    if (typeof DecompressionStream !== 'function') throw invalid();
    try {
      const stream = new Blob([document.compressed]).stream()
        .pipeThrough(new DecompressionStream('deflate-raw'));
      // The central directory is not trusted to bound decompression output.
      const reader = stream.getReader();
      const chunks = [];
      let total = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_XML_BYTES || total > document.expanded) throw invalid();
          chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      bytes = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
    } catch { throw invalid(); }
  }
  if (bytes.length !== document.expanded) throw invalid();
  try { return decoder.decode(bytes); } catch { throw invalid(); }
}

export async function previewDocxText(input) {
  const source = await docxDocumentXml(input);
  if (typeof DOMParser === 'undefined') throw invalid();
  const xml = new DOMParser().parseFromString(source, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw invalid();
  const body = xml.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'body')[0];
  if (!body) throw invalid();
  const paragraphs = body.getElementsByTagNameNS(
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p');
  const lines = [];
  for (const paragraph of paragraphs) {
    const values = [];
    // Get text from Word runs, not XML markup. No HTML is injected.
    for (const node of paragraph.getElementsByTagNameNS(
      'http://schemas.openxmlformats.org/wordprocessingml/2006/main', 't'))
      values.push(node.textContent || '');
    lines.push(values.join(''));
  }
  return lines.join('\n').trim() || 'This document has no extractable text. Download it to view its full layout.';
}
