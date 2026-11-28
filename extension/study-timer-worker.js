// Single local study timer. Absolute timestamps survive tab and worker restarts.
function studyTimerElapsed(state, now = Date.now()) {
  const elapsed = Math.max(0, state.elapsedMs + (state.startedAt === null ? 0 : Math.max(0, now - state.startedAt)));
  return state.goalMinutes ? Math.min(elapsed, state.goalMinutes * 60000) : elapsed;
}
function normalizeStudyTimer(value, now = Date.now()) {
  const goalMinutes = Number.isInteger(value?.goalMinutes) && value.goalMinutes >= 0 && value.goalMinutes <= 1440 ? value.goalMinutes : 0;
  const elapsedMs = Number.isSafeInteger(value?.elapsedMs) && value.elapsedMs >= 0 ? value.elapsedMs : 0;
  const startedAt = Number.isSafeInteger(value?.startedAt) && value.startedAt > 0 ? Math.min(value.startedAt, now) : null;
  const state = { goalMinutes, elapsedMs, startedAt };
  if (goalMinutes && studyTimerElapsed(state, now) >= goalMinutes * 60000)
    return { goalMinutes, elapsedMs: goalMinutes * 60000, startedAt: null };
  return state;
}
function changeStudyTimer(value, action, goal, now = Date.now()) {
  const state = normalizeStudyTimer(value, now);
  if (action === 'get') return state;
  if (action === 'reset') return { ...state, elapsedMs: 0, startedAt: null };
  if (action === 'set') {
    if (!Number.isInteger(goal) || goal < 0 || goal > 1440) throw new Error('Enter 0–1440 minutes (0 for stopwatch).');
    if (state.startedAt !== null || state.elapsedMs !== 0) throw new Error('Reset the timer before changing its target.');
    return { goalMinutes: goal, elapsedMs: 0, startedAt: null };
  }
  if (action === 'pause') return { ...state, elapsedMs: studyTimerElapsed(state, now), startedAt: null };
  if (action === 'start') {
    if (state.startedAt !== null) return state;
    if (state.goalMinutes && state.elapsedMs >= state.goalMinutes * 60000)
      return { ...state, elapsedMs: 0, startedAt: now };
    return { ...state, startedAt: now };
  }
  throw new Error('Unknown timer action.');
}

// Serialize updates from different tabs; read only this dedicated storage key.
let studyTimerQueue = Promise.resolve();
function updateLocalStudyTimer(action, goal) {
  const task = studyTimerQueue.then(async () => {
    const stored = await chrome.storage.local.get('ogeStudyTimer');
    const timer = changeStudyTimer(stored.ogeStudyTimer, action, goal);
    if (JSON.stringify(stored.ogeStudyTimer) !== JSON.stringify(timer))
      await chrome.storage.local.set({ ogeStudyTimer: timer });
    return timer;
  });
  studyTimerQueue = task.catch(() => {});
  return task;
}
