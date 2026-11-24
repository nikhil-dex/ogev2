// Record explicit completion instants only. Migrated legacy progress has no invented dates.
export function completionTimeline(track, nextIds, now = new Date()) {
  const before = new Set(track.completedVideoIds || []);
  const previous = new Map((track.completionTimeline || []).map(item => [item.videoId, item.completedAt]));
  return nextIds.flatMap(videoId => {
    if (previous.has(videoId)) return [{ videoId, completedAt: previous.get(videoId) }];
    if (track.progressMode === 'videoIds' && !before.has(videoId)) return [{ videoId, completedAt: now.toISOString() }];
    return [];
  });
}
export function localStudyDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
export function flexibleStudyPlan(videos, completedIds, timeline, perDay, startDate = '', today = localStudyDate()) {
  const unique = [...new Map(videos.map(video => [video.videoId, video])).values()];
  const done = new Set(completedIds);
  const activeIds = new Set(unique.map(video => video.videoId));
  const todayIds = new Set((timeline || []).filter(item => done.has(item.videoId) && activeIds.has(item.videoId) && Number.isFinite(Date.parse(item.completedAt)) && localStudyDate(new Date(item.completedAt)) === today).map(item => item.videoId));
  const remaining = unique.filter(video => !done.has(video.videoId));
  const firstDate = startDate && startDate > today ? startDate : today;
  const isToday = firstDate === today;
  const allowance = isToday ? Math.max(0, perDay - todayIds.size) : perDay;
  const blocks = [];
  let cursor = 0;
  let dateOffset = 0;
  if (isToday && allowance === 0) dateOffset = 1;
  while (cursor < remaining.length) {
    const count = dateOffset === 0 ? allowance : perDay;
    const date = new Date(firstDate + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + dateOffset);
    blocks.push({ day: blocks.length + 1, date: date.toISOString().slice(0,10), videos: remaining.slice(cursor,cursor+count) });
    cursor += count;
    dateOffset++;
  }
  return { blocks, completedToday: todayIds.size, remaining: remaining.length, goalMet: todayIds.size >= perDay,
    undatedCompleted: unique.filter(video => done.has(video.videoId) && !(timeline || []).some(item => item.videoId === video.videoId)).length };
}
