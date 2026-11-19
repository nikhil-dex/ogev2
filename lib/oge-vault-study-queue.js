// Pure, immutable queue operations. Every page is a snapshot of the owner's
// committed GitHub Vault Notes; the UI never fabricates a review write.
export function appendStudyDueNotes(existing, incoming) {
  if (!Array.isArray(existing) || !Array.isArray(incoming))
    throw new TypeError('Invalid study queue.');
  const seen = new Set(existing.map((note) => note.id));
  const next = [...existing];
  for (const note of incoming) {
    if (!note || typeof note.id !== 'string' || !note.id ||
        typeof note.heading !== 'string' || typeof note.answer !== 'string')
      throw new TypeError('Invalid GitHub study note.');
    if (note.due === true && !seen.has(note.id)) {
      seen.add(note.id);
      next.push(note);
    }
  }
  return next;
}

export function removeReviewedStudyNote(existing, id) {
  if (!Array.isArray(existing) || typeof id !== 'string') throw new TypeError('Invalid review.');
  return existing.filter((note) => note.id !== id);
}

export function skipStudyNote(existing) {
  if (!Array.isArray(existing)) throw new TypeError('Invalid study queue.');
  return existing.length < 2 ? [...existing] : [...existing.slice(1), existing[0]];
}
