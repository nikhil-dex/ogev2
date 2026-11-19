// A Note opened from backlinks may not belong to the currently filtered
// subject, or may come from a later GitHub Vault page. Keep reader navigation
// available without changing the user's library filters.
export function readerSequenceForNote(current, visibleNotes = [], loadedNotes = [], sortOrder = 'newest') {
  if (!current) return [];
  const matchesVisible = visibleNotes.some((note) => note.id === current.id);
  const source = matchesVisible
    ? visibleNotes
    : [...loadedNotes.filter((note) => note.id !== current.id), current];
  const subjectNotes = source.filter((note) => note.subjectSlug === current.subjectSlug);
  if (matchesVisible) return subjectNotes;
  return subjectNotes.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned))
      return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (sortOrder === 'oldest')
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    if (sortOrder === 'title-asc')
      return String(a.heading || '').localeCompare(String(b.heading || ''));
    if (sortOrder === 'title-desc')
      return String(b.heading || '').localeCompare(String(a.heading || ''));
    return new Date(b.updatedAt || b.createdAt || 0) -
      new Date(a.updatedAt || a.createdAt || 0);
  });
}
