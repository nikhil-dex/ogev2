// Study progress is metadata. Note headings and bodies stay in GitHub.
export const VAULT_STUDY_COLLECTION = 'vaultStudyProgress';
export const STUDY_INTERVALS = Object.freeze({ again: 0, hard: 1, good: 1, easy: 4 });
const DAY_MS = 86400000;

/** Same adaptive learning intervals as OgeNotes; existing progress starts at its saved interval. */
export function nextReviewSchedule(rating, previous = {}, now = new Date()) {
  if (!Object.hasOwn(STUDY_INTERVALS, rating) || !(now instanceof Date) ||
      Number.isNaN(now.getTime())) throw new TypeError('Invalid review rating or date.');
  const previousDays = Number.isSafeInteger(previous?.intervalDays) &&
    previous.intervalDays >= 0 && previous.intervalDays <= 36500 ? previous.intervalDays : 0;
  const intervalDays = rating === 'again' ? 0 : rating === 'hard'
    ? Math.max(1, Math.round((previousDays || 1) * 1.2))
    : rating === 'good' ? previousDays === 0 ? 1 : previousDays === 1 ? 3 : Math.round(previousDays * 2)
    : previousDays ? Math.max(4, Math.round(previousDays * 2.5)) : 4;
  const dueAt = new Date(now.getTime() +
    (rating === 'again' ? 10 * 60 * 1000 : intervalDays * DAY_MS));
  return { dueAt, intervalDays };
}
export function nextReviewDate(rating, now = new Date(), previous = {}) {
  return nextReviewSchedule(rating, previous, now).dueAt;
}

export function progressKey(ownerId, repoId, noteId) {
  if (typeof ownerId !== 'string' || !ownerId ||
      !Number.isSafeInteger(repoId) || repoId < 1 ||
      !/^[a-f0-9-]{36}$/i.test(noteId || ''))
    throw new TypeError('Invalid study progress identity.');
  return ownerId + ':' + repoId + ':' + noteId.toLowerCase();
}

export async function recordVaultReview(db, client, ownerId, note, rating, now = new Date()) {
  const key = progressKey(ownerId, client.vault.repoId, note.id);
  const collection = db.collection('vaultStudyProgress');
  const prior = await collection.findOne({ _id: key, ownerId, repoId: client.vault.repoId },
    { projection: { intervalDays: 1 } });
  const schedule = nextReviewSchedule(rating, prior, now);
  const next = schedule.dueAt;
  await collection.updateOne({ _id: key }, {
    $set: {
      ownerId, repoId: client.vault.repoId, noteId: note.id,
      subjectId: note.subjectId, rating, reviewedAt: now, dueAt: next,
      intervalDays: schedule.intervalDays,
    },
    $inc: { reviewCount: 1 },
  }, { upsert: true });
  return { noteId: note.id, reviewDueAt: next.toISOString(),
    intervalDays: schedule.intervalDays, rating,
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
