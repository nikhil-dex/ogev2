import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('Tracks visual polish is scoped, theme-aware and retains existing actions', async () => {
 const source = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
 assert.ok(source.includes('[data-panel="tracks"] .track-card'));
 assert.ok(source.includes(':host([data-oge-theme="dark"]) [data-panel="tracks"]'));
 assert.ok(source.includes('grid-template-columns:repeat(auto-fit'));
 assert.ok(source.includes('track-current-label'));
 assert.ok(source.includes('track-complete'));
 for (const action of ['WATCH_NEXT_LESSON','REFRESH_TRACK_PLAYLIST','COMPLETE_NEXT_LESSON','UNDO_CURRENT_LESSON','LOOKUP_LESSON_NOTE','CREATE_LEARNING_TRACK']) assert.ok(source.includes(action));
});
