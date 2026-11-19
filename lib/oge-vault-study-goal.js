// Simple daily study goals remain in the current browser, like OgeNotes.
export function studyDayKey(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime()))
    throw new TypeError('Invalid study date');
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-');
}

export function readDailyStudy(storage, key, now = new Date()) {
  let data = null;
  try { data = JSON.parse(storage.getItem(key) || 'null'); } catch { /* use defaults */ }
  const goal = Number.isInteger(data?.goal) && data.goal >= 1 && data.goal <= 100
    ? data.goal : 10;
  return { date: studyDayKey(now), goal,
    completed: data?.date === studyDayKey(now) &&
      Number.isSafeInteger(data.completed) && data.completed >= 0 ? data.completed : 0 };
}

export function saveDailyStudy(storage, key, state) {
  storage.setItem(key, JSON.stringify(state));
  return state;
}

export function finishDailyStudyReview(storage, key, now = new Date()) {
  const previous = readDailyStudy(storage, key, now);
  return saveDailyStudy(storage, key, {
    ...previous, completed: previous.completed + 1,
  });
}
