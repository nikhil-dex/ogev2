import test from 'node:test';
import assert from 'node:assert/strict';
import { completionTimeline, flexibleStudyPlan, localStudyDate } from '../lib/learning-track-flexible-plan.js';
const videos = Array.from({length:5},(_,i)=>({videoId:'abc1234567'+i,title:'Lesson '+i}));
test('LT9 preserves dated completion and leaves migrated history undated',()=>{
 const now=new Date(2026,10,24,12);
 const legacy={completedVideos:1};
 assert.deepEqual(completionTimeline(legacy,[videos[0].videoId],now),[]);
 const track={progressMode:'videoIds',completedVideoIds:[videos[0].videoId]};
 const next=completionTimeline(track,[videos[0].videoId,videos[1].videoId],now);
 assert.equal(next.length,1);
 assert.equal(next[0].completedAt,now.toISOString());
 assert.deepEqual(completionTimeline({...track,completedVideoIds:[videos[0].videoId,videos[1].videoId],completionTimeline:next},[videos[0].videoId],now),[]);
});
test('LT9 carries unfinished lessons forward and counts unique dated progress',()=>{
 const now=new Date(2026,10,24,12), today=localStudyDate(now);
 const ids=[videos[0].videoId,videos[1].videoId];
 const timeline=[{videoId:ids[1],completedAt:now.toISOString()}];
 const plan=flexibleStudyPlan([...videos,videos[4]],ids,timeline,2,'2026-11-01',today);
 assert.equal(plan.completedToday,1);
 assert.equal(plan.undatedCompleted,1);
 assert.equal(plan.remaining,3);
 assert.equal(plan.blocks[0].date,today);
 assert.equal(plan.blocks[0].videos.length,1);
 assert.equal(plan.blocks[1].videos.length,2);
 const met=flexibleStudyPlan(videos,ids,timeline,1,'',today);
 assert.equal(met.goalMet,true);
 assert.equal(met.blocks[0].date,'2026-11-25');
});
