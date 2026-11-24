import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildDailyLessons, publicLearningTrack } from '../lib/learning-tracks.js';
import {
  validateCompletedVideoIds, changeVideoCompletion,
  buildIdentityLessonDays, currentIdentityLearningDay, nextExtensionLesson, extensionLessonChange,
} from '../lib/learning-track-video-progress.js';

const ids = ['abc12345678', 'abc12345679', 'abc12345670', 'abc12345671'];
const videos = ids.map((videoId, position) => ({ videoId, position, title: 'Lesson ' + position }));
const base = { progressMode: 'count', completedVideos: 2, totalVideos: 4 };

test('legacy count is preserved unless migration is explicit and confirmed', () => {
  assert.equal(publicLearningTrack(base).progressMode, 'count');
  assert.deepEqual(publicLearningTrack(base).completedVideoIds, []);
  assert.ok(changeVideoCompletion(base, { action: 'adopt-video-ids', videoIds: [ids[0]], expectedCompleted: 2 }).error);
  assert.ok(changeVideoCompletion(base, { action: 'adopt-video-ids', videoIds: [ids[0], ids[0]], expectedCompleted: 2 }).error);
  assert.ok(changeVideoCompletion(base, { action: 'adopt-video-ids', videoIds: [ids[0], ids[1]], expectedCompleted: 1 }).error);
  const converted = changeVideoCompletion(base, { action: 'adopt-video-ids', videoIds: [ids[0], ids[1]], expectedCompleted: 2 });
  assert.equal(converted.value.progressMode, 'videoIds');
  assert.deepEqual(converted.value.completedVideoIds, [ids[0], ids[1]]);
  assert.equal(converted.value.completedVideos, 2);
  assert.equal(base.progressMode, 'count');
});

test('video IDs are validated and completed only once', () => {
  assert.equal(validateCompletedVideoIds([ids[0], ids[1]]), true);
  assert.equal(validateCompletedVideoIds([ids[0], ids[0]]), false);
  assert.equal(validateCompletedVideoIds(['invalid']), false);
  assert.equal(validateCompletedVideoIds(Array(501).fill(ids[0])), false);
  const converted = { ...base, progressMode: 'videoIds', completedVideoIds: [ids[0], ids[1]] };
  assert.ok(changeVideoCompletion(converted, { action: 'complete-video', videoId: ids[1] }).error);
  const added = changeVideoCompletion(converted, { action: 'complete-video', videoId: ids[2] });
  assert.deepEqual(added.value.completedVideoIds, [ids[0], ids[1], ids[2]]);
  assert.equal(added.value.completedVideos, 3);
  const undone = changeVideoCompletion({ ...converted, ...added.value }, { action: 'undo-video', videoId: ids[1] });
  assert.deepEqual(undone.value.completedVideoIds, [ids[0], ids[2]]);
  assert.ok(changeVideoCompletion(converted, { action: 'undo-video', videoId: ids[3] }).error);
  assert.ok(changeVideoCompletion(base, { action: 'complete-video', videoId: ids[2] }).error);
});

test('reordered playlists preserve video identity and select first unfinished lesson', () => {
  const reordered = [videos[2], videos[0], videos[3], videos[1]];
  const days = buildIdentityLessonDays(reordered, 2, [ids[0], ids[1]], '2026-11-25', buildDailyLessons);
  assert.deepEqual(days.map((d) => d.videos.map((v) => v.completed)), [[false, true], [false, true]]);
  const focus = currentIdentityLearningDay(days);
  assert.equal(focus.day, 1);
  assert.equal(focus.next.videoId, ids[2]);
  assert.equal(focus.date, '2026-11-25');
  assert.equal(focus.completedInDay, 1);
  assert.equal(currentIdentityLearningDay(buildIdentityLessonDays(videos, 2, ids, '', buildDailyLessons)), null);
  const removedVideo = buildIdentityLessonDays(videos.slice(1), 2, [ids[0]], '', buildDailyLessons);
  assert.equal(removedVideo[0].videos[0].completed, false);
});

test('owner-scoped API rejects stale versions and disables legacy count writes after upgrade', async () => {
  const route = await readFile(new URL('../app/api/learning-tracks/route.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../app/learning-tracks/page.js', import.meta.url), 'utf8');
  assert.match(route, /action\) return updateIdentityProgress\(parsed.value\)/);
  assert.match(route, /track.progressMode === 'videoIds'/);
  assert.match(route, /changeVideoCompletion\(track/);
  assert.match(route, /expectedUpdatedAt/);
  assert.match(route, /ownerId: ctx.ownerId, updatedAt: track.updatedAt/);
  assert.match(route, /withActiveOwnerMutation/);
  assert.match(ui, /Use video-specific progress/);
  assert.match(ui, /window.confirm\(prompt\)/);
  assert.match(ui, /snapshot.videos.slice\(0, track.completedVideos\)/);
  assert.match(ui, /currentIdentityLearningDay\(days\)/);
  assert.match(ui, /buildIdentityLessonDays\(/);
  assert.match(ui, /identityMode \? focus.next.videoId : null/);
  assert.match(ui, /Mark not complete/);
  assert.match(ui, /Some completed videos are no longer in this playlist snapshot/);
});

test('extension next lesson follows identity after reorder and never guesses legacy completion', () => {
  const reordered = [videos[2], videos[0], videos[3], videos[1]];
  assert.equal(nextExtensionLesson({ progressMode: 'videoIds', completedVideoIds: [ids[0], ids[2]] }, reordered).videoId, ids[3]);
  assert.equal(nextExtensionLesson({ progressMode: 'videoIds', completedVideoIds: ids }, reordered), null);
  assert.equal(nextExtensionLesson({ completedVideos: 0 }, reordered).videoId, ids[2]);
  assert.throws(() => nextExtensionLesson(base, reordered), /video-specific progress/);
});
test('extension watch next fetches owner-scoped lesson on explicit click', async () => {
  const route = await readFile(new URL('../app/api/extension/learning-track/route.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../extension/service-worker.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.ok(route.includes('cachedPublicPlaylist(db, track.playlistId, user.googleSub)'));
  assert.ok(route.includes('_id: id, ownerId: user.googleSub'));
  assert.ok(worker.includes("chrome.tabs.update(sender.tab.id, { url: 'https://www.youtube.com/watch?v='"));
  assert.ok(ui.includes("send('WATCH_NEXT_LESSON', { id: track.id })"));
});

test('Watch next skips the current lesson without marking it complete', () => {
  const track = { progressMode: 'videoIds', completedVideoIds: [ids[1]] };
  assert.equal(nextExtensionLesson(track, videos, ids[0]).videoId, ids[2]);
  assert.equal(nextExtensionLesson(track, videos, ids[3]), null);
  assert.deepEqual(track.completedVideoIds, [ids[1]]);
  assert.equal(nextExtensionLesson({ completedVideos: 0 }, videos, ids[0]).videoId, ids[1]);
});
test('extension creation detects totals and starts with identity progress', async () => {
  const route = await readFile(new URL('../app/api/extension/learning-track/route.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
  assert.ok(route.includes("totalVideos: snapshot.totalVideos, progressMode: 'videoIds', completedVideoIds: []"));
  assert.ok(!ui.includes('data-track-total'));
});

test('extension completion is explicit, idempotent, membership checked and undoable', () => {
  const track = { progressMode: 'videoIds', completedVideoIds: [], completedVideos: 0, totalVideos: 4 };
  const change = extensionLessonChange(track, videos, ids[0], 'complete-video');
  assert.deepEqual(change.value.completedVideoIds, [ids[0]]);
  assert.equal(change.next.videoId, ids[1]);
  const saved = { ...track, ...change.value };
  assert.equal(extensionLessonChange(saved, videos, ids[0], 'complete-video').value.completedVideos, 1);
  assert.equal(extensionLessonChange(saved, videos, ids[0], 'undo-video').value.completedVideos, 0);
  assert.ok(extensionLessonChange(track, videos, 'xxxxxxxxxxx', 'complete-video').error);
  assert.ok(extensionLessonChange(base, videos, ids[0], 'complete-video').error);
  assert.equal(extensionLessonChange({ completedVideos: 0 }, videos, ids[0], 'complete-video').value.progressMode, 'videoIds');
});

test('removed completed video does not block a new current lesson', () => {
 const track = { progressMode: 'videoIds', completedVideoIds: [ids[0], ids[1]], completedVideos: 2, totalVideos: 2 };
 const result = extensionLessonChange(track, videos.slice(2), ids[2], 'complete-video');
 assert.deepEqual(result.value.completedVideoIds, [ids[0], ids[1], ids[2]]);
 assert.ok(result.hasUnfinished);
});
