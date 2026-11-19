// Daily study data is owner + repository metadata only.
// Note headings and bodies continue to live in the private GitHub Vault.
export const VAULT_DAILY_GOALS_COLLECTION = 'vaultStudyDailyGoals';

export function validateStudyDay(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      new Date(value + 'T00:00:00.000Z').toISOString().slice(0, 10) !== value)
    throw new TypeError('Invalid daily study date.');
  const delta = Math.abs(Date.parse(value + 'T00:00:00.000Z') -
    Date.parse(now.toISOString().slice(0, 10) + 'T00:00:00.000Z'));
  if (delta > 86400000) throw new TypeError('Study date must be today in your timezone.');
  return value;
}

export function vaultDailyGoalId(ownerId, repoId, day) {
  if (typeof ownerId !== 'string' || !ownerId ||
      !Number.isSafeInteger(repoId) || repoId < 1 ||
      typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new TypeError('Invalid daily study identity.');
  return ownerId + ':' + repoId + ':' + day;
}

function present(row, day) {
  return {
    date: day, goal: Number.isSafeInteger(row?.goal) && row.goal >= 1 && row.goal <= 100
      ? row.goal : 10,
    completed: Array.isArray(row?.noteIds) ? row.noteIds.length : 0,
  };
}

export async function readVaultDailyGoal(db, ownerId, repoId, day) {
  const row = await db.collection('vaultStudyDailyGoals').findOne({
    _id: vaultDailyGoalId(ownerId, repoId, day),
  }, { projection: { goal: 1, noteIds: 1 } });
  return present(row, day);
}

export async function setVaultDailyGoal(db, ownerId, repoId, day, goal) {
  if (!Number.isSafeInteger(goal) || goal < 1 || goal > 100)
    throw new TypeError('Select a daily goal between 1 and 100.');
  const _id = vaultDailyGoalId(ownerId, repoId, day);
  await db.collection('vaultStudyDailyGoals').updateOne(
    { _id }, {
      $set: { goal },
      $setOnInsert: { ownerId, repoId, day },
    }, { upsert: true },
  );
  return readVaultDailyGoal(db, ownerId, repoId, day);
}

export async function finishVaultDailyReview(db, ownerId, repoId, day, noteId) {
  if (typeof noteId !== 'string' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(noteId))
    throw new TypeError('Invalid reviewed Note.');
  const _id = vaultDailyGoalId(ownerId, repoId, day);
  await db.collection('vaultStudyDailyGoals').updateOne(
    { _id }, {
      $addToSet: { noteIds: noteId.toLowerCase() },
      $setOnInsert: { ownerId, repoId, day, goal: 10 },
    }, { upsert: true },
  );
  return readVaultDailyGoal(db, ownerId, repoId, day);
}
