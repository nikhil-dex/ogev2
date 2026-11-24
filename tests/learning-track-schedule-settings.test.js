import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeTrackSchedule, publicLearningTrack, buildDailyLessons } from '../lib/learning-tracks.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('learning plans validate daily goal and exact calendar date', () => {
  assert.deepEqual(normalizeTrackSchedule({ videosPerDay: 2, startDate: '2028-02-29' }),
    { value: { videosPerDay: 2, startDate: '2028-02-29' } });
  assert.deepEqual(normalizeTrackSchedule({ videosPerDay: 1 }),
    { value: { videosPerDay: 1, startDate: '' } });
  for (const value of [
    { videosPerDay: 0 }, { videosPerDay: 21 }, { videosPerDay: '3' },
    { videosPerDay: 2.5 }, { videosPerDay: 2, startDate: '2027-02-29' },
    { videosPerDay: 2, startDate: '2026-13-01' },
    { videosPerDay: 2, startDate: 'tomorrow' },
  ]) assert.ok(normalizeTrackSchedule(value).error);
});
test('saved schedule is returned to owner; legacy track defaults to undated', () => {
  const data = { _id: 'track1', playlistId: 'PL1000012345', playlistUrl: 'https://www.youtube.com/playlist?list=PL1000012345',
    ownerId: 'private', title: 'ML', videosPerDay: 2, totalVideos: 5, completedVideos: 1 };
  assert.equal(publicLearningTrack(data).startDate, '');
  assert.equal(publicLearningTrack({ ...data, startDate: '2026-12-01' }).startDate, '2026-12-01');
  assert.equal(publicLearningTrack(data).ownerId, undefined);
  const videos = Array.from({ length: 5 }, (_, position) => ({ position, title: 'Lesson '+position }));
  const a = buildDailyLessons(videos, 2, 1, '2026-12-01');
  const b = buildDailyLessons(videos, 1, 1, '2026-12-08');
  assert.deepEqual(a.map((x) => x.date), ['2026-12-01', '2026-12-02', '2026-12-03']);
  assert.deepEqual(b.map((x) => x.date), ['2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12']);
});
test('plan saves per track with owner fence, stale revision check and no progress rewrite', async () => {
  const route = await read('../app/api/learning-tracks/route.js');
  const page = await read('../app/learning-tracks/page.js');
  assert.match(route, /export async function PUT\(request\)/);
  assert.match(route, /normalizeTrackSchedule\(parsed.value\)/);
  assert.match(route, /withActiveOwnerMutation\(ctx.db, ctx.ownerId/);
  assert.match(route, /new Date\(track.updatedAt\).toISOString\(\) !== expectedUpdatedAt/);
  assert.match(route, /_id: id, ownerId: ctx.ownerId, updatedAt: track.updatedAt/);
  assert.match(route, /\$set: \{ \.\.\.plan.value, updatedAt \}/);
  assert.doesNotMatch(route.slice(route.indexOf('export async function PUT'), route.indexOf('export async function DELETE')), /\$set: \{[^\n]*completedVideos/);
  assert.match(page, /const \[planDrafts, setPlanDrafts\] = useState\(\{\}\)/);
  assert.match(page, /expectedUpdatedAt: track.updatedAt/);
  assert.match(page, /Save plan/);
  assert.match(page, /track.startDate \|\| ''/);
  assert.doesNotMatch(page, /const \[startDate, setStartDate\]/);
});
