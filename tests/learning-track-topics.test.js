import test from 'node:test';
import assert from 'node:assert/strict';
import { changeTrackTopics, lessonTopic } from '../lib/learning-track-topics.js';
const a='12345678-1234-1234-1234-123456789abc', b='22345678-1234-1234-1234-123456789abc';
const videos=[{videoId:'abc12345678',title:'One'},{videoId:'abc12345679',title:'Two'}];
test('LT4 topic identity survives reorder, rename and split', () => {
  const first=changeTrackTopics({}, {action:'assign-topic',title:'Basics',videoIds:videos.map(v=>v.videoId)}, videos,a);
  assert.equal(first.value.length,1);
  const renamed=changeTrackTopics({topics:first.value},{action:'rename-topic',topicId:a,title:'Intro'},[],b);
  assert.equal(lessonTopic({topics:renamed.value},videos[1]).key,'topic:'+a);
  const split=changeTrackTopics({topics:renamed.value},{action:'assign-topic',title:'Next',videoIds:[videos[1].videoId]},[...videos].reverse(),b);
  assert.equal(split.value.length,2);
  const merged=changeTrackTopics({topics:split.value},{action:'merge-topic',topicId:a,sourceTopicId:b},[],b);
  assert.equal(merged.value.length,1);
  assert.equal(merged.value[0].videoIds.length,2);
  const clear=changeTrackTopics({topics:merged.value},{action:'clear-topic',videoIds:[videos[0].videoId]},videos,b);
  assert.equal(lessonTopic({topics:clear.value},videos[0]).key,'video:'+videos[0].videoId);
  assert.ok(changeTrackTopics({}, {action:'assign-topic',title:'Wrong',videoIds:['xxxxxxxxxxx']}, videos,a).error);
});
