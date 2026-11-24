import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('lesson destination uses expected context and existing revision-aware append', async () => {
 const route=await readFile(new URL('../app/api/extension/learning-note/route.js',import.meta.url),'utf8');
 const worker=await readFile(new URL('../extension/service-worker.js',import.meta.url),'utf8');
 assert.ok(route.includes("data.expectedVideoId !== videoId"));
 assert.ok(route.includes("data.expectedVersion === existing.sha"));
 assert.ok(route.includes("appendRequest(ids.mongoId, data.expectedVersion, previous.answer)"));
 assert.ok(worker.includes("LOOKUP_LESSON_NOTE"));
});
