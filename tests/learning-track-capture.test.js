import test from 'node:test';
import assert from 'node:assert/strict';
import { learningCaptureIds } from '../lib/learning-track-capture.js';
test('LT5 stable target identity per owner, subject, track and topic', () => {
  const first=learningCaptureIds('owner','track','subject','topic:one');
  assert.deepEqual(first,learningCaptureIds('owner','track','subject','topic:one'));
  assert.notDeepEqual(first,learningCaptureIds('owner2','track','subject','topic:one'));
  assert.notDeepEqual(first,learningCaptureIds('owner','track','subject','video:one'));
  assert.notDeepEqual(first,learningCaptureIds('owner','track','subject2','topic:one'));
  assert.match(first.vaultId,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.match(first.mongoId,/^[a-f0-9]{24}$/);
});
