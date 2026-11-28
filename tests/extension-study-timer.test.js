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
