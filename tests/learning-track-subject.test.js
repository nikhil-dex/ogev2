import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTrackSubject, normalizeLearningTrack, publicLearningTrack } from '../lib/learning-tracks.js';
const slug = '12345678-1234-1234-1234-123456789abc';
test('LT3 optional subject mapping preserves legacy tracks', () => {
  assert.equal(normalizeTrackSubject(undefined).value, '');
  assert.equal(normalizeTrackSubject(slug).value, slug);
  assert.ok(normalizeTrackSubject('not-a-subject').error);
  const input = { url: 'https://www.youtube.com/playlist?list=PL0123456789example', title: 'ML', videosPerDay: 3 };
  assert.equal(normalizeLearningTrack({ ...input, subjectSlug: slug }).value.subjectSlug, slug);
  assert.ok(normalizeLearningTrack({ ...input, subjectSlug: {} }).error);
  assert.equal(publicLearningTrack({}).subjectSlug, '');
});
