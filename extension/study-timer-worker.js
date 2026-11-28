// Single local study timer. Absolute timestamps survive tab and worker restarts.
function studyTimerElapsed(state, now = Date.now()) {
  const elapsed = Math.max(0, state.elapsedMs + (state.startedAt === null ? 0 : Math.max(0, now - state.startedAt)));
  return state.goalMinutes ? Math.min(elapsed, state.goalMinutes * 60000) : elapsed;
}
function normalizeStudyTimer(value, now = Date.now()) {
  const goalMinutes = Number.isInteger(value?.goalMinutes) && value.goalMinutes >= 0 && value.goalMinutes <= 1440 ? value.goalMinutes : 0;
  const elapsedMs = Number.isSafeInteger(value?.elapsedMs) && value.elapsedMs >= 0 ? value.elapsedMs : 0;
  const startedAt = Number.isSafeInteger(value?.startedAt) && value.startedAt > 0 ? Math.min(value.startedAt, now) : null;
  const sessionId = Number.isSafeInteger(value?.sessionId) && value.sessionId >= 0 ? value.sessionId : 0;
  const state = { goalMinutes, elapsedMs, startedAt, sessionId, notified: value?.notified === true };
  if (goalMinutes && studyTimerElapsed(state, now) >= goalMinutes * 60000)
    return { ...state, elapsedMs: goalMinutes * 60000, startedAt: null };
  return state;
}
function changeStudyTimer(value, action, goal, now = Date.now()) {
  const state = normalizeStudyTimer(value, now);
  if (action === 'get') return state;
  if (action === 'reset') return { ...state, elapsedMs: 0, startedAt: null, notified: false };
  if (action === 'set') {
    if (!Number.isInteger(goal) || goal < 0 || goal > 1440) throw new Error('Enter 0–1440 minutes (0 for stopwatch).');
    if (state.startedAt !== null || state.elapsedMs !== 0) throw new Error('Reset the timer before changing its target.');
    return { ...state, goalMinutes: goal, elapsedMs: 0, startedAt: null, notified: false };
  }
  if (action === 'pause') return { ...state, elapsedMs: studyTimerElapsed(state, now), startedAt: null };
  if (action === 'start') {
    if (state.startedAt !== null) return state;
    if (state.elapsedMs === 0 || (state.goalMinutes && state.elapsedMs >= state.goalMinutes * 60000))
      return { ...state, elapsedMs: 0, startedAt: now, sessionId: Math.max(now, state.sessionId + 1), notified: false };
    return { ...state, startedAt: now };
  }
  throw new Error('Unknown timer action.');
}

// Serialize updates from different tabs; read only this dedicated storage key.
let studyTimerQueue = Promise.resolve();
function updateLocalStudyTimer(action, goal, expectedSessionId) {
  const task = studyTimerQueue.then(async () => {
    const stored = await chrome.storage.local.get('ogeStudyTimer');
    const current = normalizeStudyTimer(stored.ogeStudyTimer);
    let timer = current;
    let claimed = false;
    const finished = current.goalMinutes > 0 && current.elapsedMs >= current.goalMinutes * 60000;
    if (action === 'claim') {
      if (finished && !current.notified) {
        timer = { ...current, notified: true };
        claimed = true;
      }
    } else if (action === 'toast-reset' || action === 'toast-reuse') {
      if (finished && current.sessionId === expectedSessionId) {
        timer = changeStudyTimer(current, action === 'toast-reset' ? 'reset' : 'start', goal);
      }
    } else {
      timer = changeStudyTimer(current, action, goal);
    }
    if (JSON.stringify(stored.ogeStudyTimer) !== JSON.stringify(timer))
      await chrome.storage.local.set({ ogeStudyTimer: timer });
    return { timer, claimed };
  });
  studyTimerQueue = task.catch(() => {});
  return task;
}
