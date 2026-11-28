import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../extension/study-timer-worker.js', import.meta.url), 'utf8');
const ctx = {};
vm.runInNewContext(source, ctx);
const change = (state, action, goal, now) => ctx.changeStudyTimer(state, action, goal, now);
test('study stopwatch pauses and resumes without counting breaks', () => {
 let state = change(null, 'start', null, 1000);
 state = change(state, 'pause', null, 31000);
 assert.equal(state.elapsedMs, 30000);
 state = change(state, 'start', null, 91000);
 assert.equal(ctx.studyTimerElapsed(state, 101000), 40000);
 assert.equal(change(state, 'reset', null, 101000).elapsedMs, 0);
});
test('countdown caps elapsed time, can be reused and reset preserves target', () => {
 let state = change(null, 'set', 1, 1000);
 state = change(state, 'start', null, 1000);
 assert.equal(ctx.studyTimerElapsed(state, 90000), 60000);
 const done = change(state, 'get', null, 90000);
 assert.equal(done.startedAt, null);
 assert.equal(change(done, 'reset', null, 90000).goalMinutes, 1);
 assert.equal(change(done, 'start', null, 90000).elapsedMs, 0);
 assert.throws(() => change(null, 'set', -1, 1000));
});
test('timer lives in header independently of selected tool', async () => {
 const ui = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
 assert.ok(ui.includes('data-timer-toggle'));
 assert.ok(ui.includes('data-study-timer hidden'));
 assert.ok(ui.includes('changes.ogeStudyTimer'));
});

test('completion notification is claimed only once across concurrent tabs; reuse starts a new session', async () => {
 let stored = { goalMinutes: 1, elapsedMs: 60000, startedAt: null, sessionId: 123, notified: false };
 const sandbox = { chrome: { storage: { local: {
   get: async () => ({ ogeStudyTimer: stored }),
   set: async value => { stored = value.ogeStudyTimer; },
 } } } };
 vm.runInNewContext(source, sandbox);
 const results = await Promise.all([sandbox.updateLocalStudyTimer('claim'), sandbox.updateLocalStudyTimer('claim')]);
 assert.equal(results.filter(item => item.claimed).length, 1);
 assert.equal(stored.notified, true);
 const stale = await sandbox.updateLocalStudyTimer('toast-reuse', null, 999);
 assert.equal(stale.timer.sessionId, 123);
 const reused = await sandbox.updateLocalStudyTimer('toast-reuse', null, 123);
 assert.equal(reused.timer.goalMinutes, 1);
 assert.equal(reused.timer.elapsedMs, 0);
 assert.equal(reused.timer.notified, false);
 assert.notEqual(reused.timer.sessionId, 123);
 const oldReset = await sandbox.updateLocalStudyTimer('toast-reset', null, 123);
 assert.equal(oldReset.timer.sessionId, reused.timer.sessionId);
 assert.equal(oldReset.timer.startedAt, reused.timer.startedAt);
});
test('toast appears outside the toolbelt and supports dismiss, reuse and reset', async () => {
 const ui = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
 assert.ok(ui.includes('document.documentElement.append(element)'));
 assert.ok(ui.includes("action: 'claim'"));
 assert.ok(ui.includes('data-toast-reuse'));
 assert.ok(ui.includes('data-toast-reset'));
 assert.ok(ui.includes('document.hasFocus()'));
 assert.ok(ui.includes('setTimeout(dismissStudyToast, 10000)'));
});
