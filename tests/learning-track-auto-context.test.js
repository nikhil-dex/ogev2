import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('LT6 automatic lesson destination and manual override are wired', async () => {
 const source = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
 for (const token of ['syncLessonDestination()', 'yt-navigate-finish', 'chooseManualDestination', 'draftLessonKey !== key', 'lessonLookupBusy || lessonLookupFailed', 'result.version || result.sha']) assert.ok(source.includes(token));
});
