// Wiki-style links are resolved from Notes already loaded in the reader.
// No new collection, index or separate storage is needed.
export function noteLinkTitles(answer) {
  if (typeof answer !== 'string') return [];
  return [...new Set([...answer.matchAll(/\[\[([^\]\r\n]{1,160})\]\]/g)]
    .map((match) => match[1].trim().toLocaleLowerCase()).filter(Boolean))];
}

export function relatedNoteLinks(note, notes) {
  if (!note || !Array.isArray(notes)) return { outgoing: [], backlinks: [] };
  const subject = note.subjectSlug || note.subject;
  const sameSubject = notes.filter((other) => other.id !== note.id &&
    (other.subjectSlug || other.subject) === subject);
  const outgoingTitles = new Set(noteLinkTitles(note.answer));
  const heading = (note.heading || '').trim().toLocaleLowerCase();
  return {
    outgoing: sameSubject.filter((other) =>
      outgoingTitles.has((other.heading || '').trim().toLocaleLowerCase())),
    backlinks: sameSubject.filter((other) => noteLinkTitles(other.answer).includes(heading)),
  };
}
