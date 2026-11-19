// Browser-side GitHub repository ZIP reader.
// Files are verified in memory and are never sent to a third-party converter.
// ZIP64 / encrypted archives are intentionally unsupported.
const MAX_ZIP_BYTES = 250 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 250 * 1024 * 1024;
const MAX_ENTRIES = 6000;
const decoder = new TextDecoder('utf-8', { fatal: true });
const invalid = (detail) => new Error('Invalid Vault ZIP: ' + detail);

export function validVaultRestorePath(path) {
  return typeof path === 'string' && path.length > 0 && path.length <= 400 &&
    !path.startsWith('/') && !path.includes('\\') && !/[\u0000-\u001f\u007f]/.test(path) &&
    !path.split('/').some((part) => !part || part === '.' || part === '..' || part === '.git') &&
    !path.endsWith('/');
}

export function restoreGroup(path) {
  if (path.startsWith('notes/')) return 'Notes';
  if (path.startsWith('quick-notes/')) return 'Quick Notes';
  if (path.startsWith('airnotes/')) return 'AirNotes';
  if (path.startsWith('saved-links/')) return 'Saved Links';
  if (path.startsWith('files/')) return 'My Files';
  if (path.startsWith('customs/')) return 'Customs';
  return 'Other Vault files';
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const b of data) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function inflate(input, expected) {
  if (typeof DecompressionStream !== 'function')
    throw invalid('this browser cannot unzip this archive.');
  const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expected || size > MAX_FILE_BYTES) throw invalid('decompressed file exceeds its declared size.');
      chunks.push(value);
    }
  } catch (error) {
    if (error?.message?.startsWith('Invalid Vault ZIP:')) throw error;
    throw invalid('compressed data cannot be read.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { output.set(chunk, at); at += chunk.length; }
  return output;
}

async function gitBlobSha(bytes) {
  const prefix = new TextEncoder().encode('blob ' + bytes.byteLength + '\u0000');
  const combined = new Uint8Array(prefix.length + bytes.length);
  combined.set(prefix);
  combined.set(bytes, prefix.length);
  const digest = await crypto.subtle.digest('SHA-1', combined);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
}

export async function inspectVaultZip(input) {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (data.length < 22 || data.length > MAX_ZIP_BYTES) throw invalid('archive is empty or too large.');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (i) => view.getUint16(i, true);
  const u32 = (i) => view.getUint32(i, true);
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === data.length) {
      eocd = i; break;
    }
  }
  if (eocd < 0 || u16(eocd + 4) !== 0 || u16(eocd + 6) !== 0)
    throw invalid('not a supported single-disk ZIP.');
  const count = u16(eocd + 10), directoryBytes = u32(eocd + 12);
  const start = u32(eocd + 16);
  if (count === 0 || count > MAX_ENTRIES || count !== u16(eocd + 8) ||
      start + directoryBytes !== eocd)
    throw invalid('central directory is incomplete.');
  const raw = [];
  let offset = start, total = 0;
  const seen = new Set();
  let prefix = null;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > eocd || u32(offset) !== 0x02014b50)
      throw invalid('invalid directory record.');
    const flags = u16(offset + 8), method = u16(offset + 10);
    const checksum = u32(offset + 16), packed = u32(offset + 20), size = u32(offset + 24);
    const nameSize = u16(offset + 28), extra = u16(offset + 30), comment = u16(offset + 32);
    const local = u32(offset + 42), end = offset + 46 + nameSize + extra + comment;
    if (end > eocd || (flags & 1) || ![0, 8].includes(method) ||
        size === 0xffffffff || packed === 0xffffffff || local === 0xffffffff)
      throw invalid('unsupported ZIP entry.');
    const archiveName = decoder.decode(data.subarray(offset + 46, offset + 46 + nameSize));
    const slash = archiveName.indexOf('/');
    if (slash < 1) throw invalid('expected a GitHub repository ZIP.');
    const root = archiveName.slice(0, slash);
    if (prefix === null) prefix = root;
    if (prefix !== root) throw invalid('mixed repository roots.');
    const path = archiveName.slice(slash + 1);
    offset = end;
    if (!path || path.endsWith('/')) continue; // Git directory marker.
    if (!validVaultRestorePath(path) || seen.has(path))
      throw invalid('duplicate or unsafe path.');
    seen.add(path);
    if (size > MAX_FILE_BYTES || total + size > MAX_TOTAL_BYTES)
      throw invalid('a file or the archive exceeds Vault limits.');
    total += size;
    if (local + 30 > start || u32(local) !== 0x04034b50)
      throw invalid('missing local file record.');
    const dataStart = local + 30 + u16(local + 26) + u16(local + 28);
    if (dataStart + packed > start) throw invalid('invalid file bounds.');
    const compressed = data.subarray(dataStart, dataStart + packed);
    const bytes = method === 0 ? compressed.slice() : await inflate(compressed, size);
    if (bytes.length !== size || crc32(bytes) !== checksum)
      throw invalid('file checksum mismatch: ' + path);
    const sha = await gitBlobSha(bytes);
    raw.push({ path, size, sha, bytes, group: restoreGroup(path) });
  }
  if (offset !== eocd) throw invalid('extra directory data.');
  if (!raw.length) throw invalid('no files to recover.');
  return { files: raw, totalBytes: total, root: prefix };
}

export function planVaultZipRestore(archive, current) {
  if (!archive?.files || !Array.isArray(current?.files) || typeof current?.head !== 'string')
    throw new TypeError('Backup and current Vault index are required.');
  const existing = new Map(current.files.map((item) => [item.path, item.sha]));
  const missing = [], conflicts = [], identical = [];
  for (const file of archive.files) {
    const sha = existing.get(file.path);
    if (!sha) missing.push(file);
    else if (sha === file.sha) identical.push(file);
    else conflicts.push(file);
  }
  return { missing, conflicts, identical, head: current.head };
}
