// Study progress is metadata. Note headings and bodies stay in GitHub.
export const VAULT_STUDY_COLLECTION = 'vaultStudyProgress';
export const STUDY_INTERVALS = Object.freeze({ again: 1, hard: 3, good: 7, easy: 14 });

export function nextReviewDate(rating, now = new Date()) {
  if (!Object.hasOwn(STUDY_INTERVALS, rating) || Number.isNaN(now.getTime()))
    throw new TypeError('Invalid review rating or date.');
  return new Date(now.getTime() + STUDY_INTERVALS[rating] * 86400000);
}

export function progressKey(ownerId, repoId, noteId) {
  if (typeof ownerId !== 'string' || !ownerId ||
      !Number.isSafeInteger(repoId) || repoId < 1 ||
      !/^[a-f0-9-]{36}$/i.test(noteId || ''))
    throw new TypeError('Invalid study progress identity.');
  return ownerId + ':' + repoId + ':' + noteId.toLowerCase();
}

export async function recordVaultReview(db, client, ownerId, note, rating, now = new Date()) {
  const next = nextReviewDate(rating, now);
  const key = progressKey(ownerId, client.vault.repoId, note.id);
  await db.collection('vaultStudyProgress').updateOne({ _id: key }, {
    $set: {
      ownerId, repoId: client.vault.repoId, noteId: note.id,
      subjectId: note.subjectId, rating, reviewedAt: now, dueAt: next,
    },
    $inc: { reviewCount: 1 },
  }, { upsert: true });
  return { noteId: note.id, reviewDueAt: next.toISOString(), rating,
    learned: rating === 'good' || rating === 'easy' };
}

export async function annotateVaultStudyPage(db, client, ownerId, notes, now = new Date()) {
  if (!notes.length) return [];
  const keys = notes.map((note) => progressKey(ownerId, client.vault.repoId, note.id));
  const rows = await db.collection('vaultStudyProgress').find({
    _id: { $in: keys }, ownerId, repoId: client.vault.repoId,
  }).toArray();
  const byId = new Map(rows.map((row) => [row.noteId, row]));
  return notes.map((note) => {
    const saved = byId.get(note.id);
    return {
      id: note.id, subjectId: note.subjectId, heading: note.heading,
      answer: note.answer, updatedAt: note.updatedAt,
      due: !saved || !(saved.dueAt instanceof Date) || saved.dueAt <= now,
      nextDueAt: saved?.dueAt instanceof Date ? saved.dueAt.toISOString() : null,
      reviewCount: saved?.reviewCount || 0,
      learned: saved?.rating === 'good' || saved?.rating === 'easy',
    };
  });
}
