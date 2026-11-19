import { relatedNoteLinks } from './oge-note-links.js';

// Scan the owner's entire GitHub Vault, using the existing snapshot-pinned
// Notes pagination API. Nothing is saved to MongoDB or a new search index.
// Only matched Notes are retained after each page.
export async function scanAllVaultNoteLinks({
  reader, fetchPage, onProgress = () => {}, shouldStop = () => false,
} = {}) {
  if (!reader?.id || typeof fetchPage !== 'function' ||
      typeof onProgress !== 'function' || typeof shouldStop !== 'function')
    throw new TypeError('Choose a Note to scan for links.');
  let cursor = null, total = null, scanned = 0, pages = 0;
  const seenCursors = new Set();
  const outgoing = new Map(), backlinks = new Map();
  do {
    if (shouldStop()) return { cancelled: true, scanned, total };
    const page = await fetchPage(cursor);
    if (shouldStop()) return { cancelled: true, scanned, total };
    if (!page || !Array.isArray(page.notes) || page.notes.length < 1 ||
        page.notes.length > 25 || !Number.isSafeInteger(page.total) ||
        page.total < 1 || page.total > 30000 ||
        (page.nextCursor !== null && typeof page.nextCursor !== 'string'))
      throw new Error('Invalid GitHub Notes page; refresh and retry the link scan.');
    const matches = relatedNoteLinks(reader, page.notes, { allSubjects: true });
    for (const note of matches.outgoing) outgoing.set(note.id, note);
    for (const note of matches.backlinks) backlinks.set(note.id, note);
    scanned += page.notes.length;
    total = page.total;
    pages += 1;
    cursor = page.nextCursor;
    if (cursor && (seenCursors.has(cursor) || pages > 1200))
      throw new Error('GitHub Notes pagination did not complete.');
    if (cursor) seenCursors.add(cursor);
    onProgress({ scanned, total });
  } while (cursor);
  if (scanned !== total)
    throw new Error('The Vault changed during scanning. Refresh and scan again.');
  return { outgoing: [...outgoing.values()], backlinks: [...backlinks.values()],
    scanned, total, complete: true, cancelled: false };
}
