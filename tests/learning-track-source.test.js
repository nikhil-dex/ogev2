import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceVideoIds, lessonSourceCapture, normalizePlaybackSeconds, timestampLabel } from '../lib/learning-track-source.js';
const a = {videoId:'abc12345678',title:'Linear [regression]'};
const b = {videoId:'abc12345679',title:'Multiple regression'};
test('LT7 creates canonical Markdown source and associates each capture', () => {
  const first = lessonSourceCapture('first notes',a);
  assert.ok(first.includes('https://www.youtube.com/watch?v=abc12345678'));
  assert.ok(first.includes('first notes'));
  const next = lessonSourceCapture('more notes',a,first);
  assert.ok(!next.includes('https://'));
  assert.ok(next.includes('more notes'));
  const other = lessonSourceCapture('different lesson',b,first+next);
  assert.ok(other.includes('https://www.youtube.com/watch?v=abc12345679'));
  assert.equal(sourceVideoIds(first+'\n'+next+'\n'+other).size,2);
});
test('LT7 recognizes existing short and playlist URLs', () => {
  const old = 'https://youtu.be/abc12345678?t=45\nhttps://www.youtube.com/watch?list=PLexample123&v=abc12345679';
  assert.deepEqual([...sourceVideoIds(old)], [a.videoId,b.videoId]);
  assert.ok(!lessonSourceCapture('new',a,old).includes('https://'));
  assert.throws(()=>lessonSourceCapture('new',{videoId:'bad',title:'x'}));
});

test('LT8 optional timestamps preserve primary sources and distinguish positions', () => {
  const first = lessonSourceCapture('first', a, '', 754.8);
  assert.ok(first.includes('Source:'));
  assert.ok(first.includes('[12:34](https://www.youtube.com/watch?v=abc12345678&t=754s)'));
  const same = lessonSourceCapture('again', a, first, 754);
  assert.ok(!same.includes('Timestamp:'));
  const other = lessonSourceCapture('later', a, first, 3601);
  assert.ok(other.includes('[1:00:01]'));
  assert.ok(!other.includes('Source:'));
  for (const invalid of [null, undefined, NaN, Infinity, -1, '20', 864001]) assert.equal(normalizePlaybackSeconds(invalid), null);
  assert.equal(timestampLabel(0), '0:00');
  assert.ok(!lessonSourceCapture('ordinary', a).includes('Timestamp:'));
});
