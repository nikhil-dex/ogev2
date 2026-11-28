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
const STUDY_ALARM = 'oge-study-timer-deadline';
async function scheduleStudyAlarm(timer) {
  if (!chrome.alarms) return;
  if (timer.goalMinutes && timer.startedAt !== null) {
    const when = timer.startedAt + timer.goalMinutes * 60000 - timer.elapsedMs;
    const existing = await chrome.alarms.get(STUDY_ALARM);
    if (!existing || Math.abs(existing.scheduledTime - when) > 1000)
      await chrome.alarms.create(STUDY_ALARM, { when });
  } else {
    await chrome.alarms.clear(STUDY_ALARM);
  }
}
async function deliverStudyCompletion(timer) {
  // Prefer a visible, focused Chrome page. A content script acknowledges only
  // if it can actually display the toast. Never alert every open tab.
  try {
    const window = await chrome.windows.getLastFocused();
    if (window.focused && window.type === 'normal') {
      const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
      if (tab?.id) {
        const result = await chrome.tabs.sendMessage(tab.id, { type: 'SHOW_STUDY_COMPLETION', timer });
        if (result?.shown === true) return true;
      }
    }
  } catch { /* Restricted pages and unavailable content scripts use desktop fallback. */ }
  try {
    if (await chrome.notifications.getPermissionLevel() !== 'granted') return false;
    await chrome.notifications.create('oge-study-' + timer.sessionId, {
      type: 'basic',
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCIgdmlld0JveD0iMCAwIDY0IDY0Ij48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHJ4PSIxNiIgZmlsbD0iIzMxNmI1MCIvPjxjaXJjbGUgY3g9IjMyIiBjeT0iMzIiIHI9IjE5IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjUiLz48cGF0aCBkPSJNMzIgMjB2MTJsOSA1IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==',
      title: 'Study session completed',
      message: 'You studied for ' + timer.goalMinutes + (timer.goalMinutes === 1 ? ' minute.' : ' minutes.') + ' Time for a break.',
      priority: 1
    });
    return true;
  } catch { return false; }
}
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
    } else if (action === 'alarm') {
      if (finished && !current.notified && await deliverStudyCompletion(current))
        timer = { ...current, notified: true };
    } else if (action === 'toast-reset' || action === 'toast-reuse') {
      if (finished && current.sessionId === expectedSessionId) {
        timer = changeStudyTimer(current, action === 'toast-reset' ? 'reset' : 'start', goal);
      }
    } else {
      timer = changeStudyTimer(current, action, goal);
    }
    if (JSON.stringify(stored.ogeStudyTimer) !== JSON.stringify(timer))
      await chrome.storage.local.set({ ogeStudyTimer: timer });
    await scheduleStudyAlarm(timer);
    return { timer, claimed };
  });
  studyTimerQueue = task.catch(() => {});
  return task;
}

// Register synchronously so a sleeping MV3 worker can receive alarms.
if (typeof chrome !== 'undefined' && chrome.alarms) {
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === STUDY_ALARM) void updateLocalStudyTimer('alarm').catch(() => {});
  });
  // Chrome may discard alarms on browser restart. Restore from stored timestamps.
  const restore = () => void updateLocalStudyTimer('alarm').catch(() => {});
  chrome.runtime.onStartup.addListener(restore);
  chrome.runtime.onInstalled.addListener(restore);
  restore();
}
