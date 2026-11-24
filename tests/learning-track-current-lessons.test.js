import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildDailyLessons, currentLearningDay } from '../lib/learning-tracks.js';

const videos = Array.from({ length: 7 }, (_, position) => ({
  position, videoId: 'abcdefghij' + (position % 10), title: 'Lesson ' + (position + 1),
  url: 'https://www.youtube.com/watch?v=abcdefghij' + (position % 10),
}));

test('current learning focus shows remaining videos, not already completed ones', () => {
  const days = buildDailyLessons(videos, 3, 1, '2026-12-01');
  const current = currentLearningDay(days, 1, 3);
  assert.equal(current.day, 1);
  assert.equal(current.date, '2026-12-01');
  assert.equal(current.completedInDay, 1);
  assert.equal(current.plannedInDay, 3);
  assert.deepEqual(current.remaining.map((v) => v.position), [1, 2]);
  assert.equal(current.next.position, 1);
});

test('moving through a day and reaching the end changes the current focus', () => {
  for (const [completed, expectedDay, nextPosition, left] of [
    [0, 1, 0, 3], [2, 1, 2, 1], [3, 2, 3, 3],
    [5, 2, 5, 1], [6, 3, 6, 1],
  ]) {
    const days = buildDailyLessons(videos, 3, completed);
    const result = currentLearningDay(days, completed, 3);
    assert.equal(result.day, expectedDay);
    assert.equal(result.next.position, nextPosition);
    assert.equal(result.remaining.length, left);
  }
  assert.equal(currentLearningDay(buildDailyLessons(videos, 3, 7), 7, 3), null);
  assert.equal(currentLearningDay([], 0, 2), null);
});

test('different study goals result in independent next lessons', () => {
  const short = currentLearningDay(buildDailyLessons(videos, 2, 2), 2, 2);
  const long = currentLearningDay(buildDailyLessons(videos, 4, 2), 2, 4);
  assert.equal(short.day, 2);
  assert.equal(long.day, 1);
  assert.equal(short.next.position, 2);
  assert.equal(long.next.position, 2);
  assert.equal(long.remaining.length, 2);
  for (const args of [[null, 0, 2], [[], -1, 2], [[], 0, 0], [[], 1.2, 2]])
    assert.throws(() => currentLearningDay(...args), TypeError);
});

test('learning page offers direct next-lesson action with completion using existing progress API', async () => {
  const source = await readFile(new URL('../app/learning-tracks/page.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/learning-tracks/learning-tracks.module.css', import.meta.url), 'utf8');
  assert.match(source, /currentLearningDay\(days, track.completedVideos, track.videosPerDay\)/);
  assert.match(source, /aria-label=\{'Next lessons for ' \+ track.title\}/);
  assert.match(source, /href=\{focus.next.url\}/);
  assert.match(source, /Mark next complete/);
  assert.match(source, /onClick=\{\(\) => progress\(track, 1\)\}/);
  assert.match(source, /track.completedVideos >= snapshot.totalVideos/);
  assert.match(source, /Legacy progress follows playlist order, not video identity/);
  assert.match(css, /\.focusList/);
  assert.match(css, /@media\(max-width:500px\)/);
});
