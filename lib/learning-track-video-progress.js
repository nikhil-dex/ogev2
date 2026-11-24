// Progress is metadata only. Completion follows canonical YouTube video IDs,
// not transient positions in playlist discovery responses.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_IDS = 500;
export function validateCompletedVideoIds(value) {
  return Array.isArray(value) && value.length <= MAX_IDS &&
    value.every((id) => typeof id === 'string' && VIDEO_ID.test(id)) &&
    new Set(value).size === value.length;
}

export function changeVideoCompletion(current, { action, videoId, videoIds, expectedCompleted }) {
  const previous = current?.completedVideoIds;
  if (action === 'adopt-video-ids') {
    // Existing positional progress is never guessed after a reorder.
    // The owner explicitly confirms the current discovered playlist prefix.
    if (current?.progressMode === 'videoIds' ||
        !Number.isSafeInteger(current?.completedVideos) ||
        current.completedVideos < 0 || current.completedVideos > MAX_IDS ||
        expectedCompleted !== current.completedVideos ||
        !validateCompletedVideoIds(videoIds) ||
        videoIds.length !== current.completedVideos)
      return { error: 'Review the playlist and confirm exactly the previously completed videos.' };
    return { value: { completedVideoIds: [...videoIds], completedVideos: videoIds.length,
      progressMode: 'videoIds' } };
  }
  if (current?.progressMode !== 'videoIds' || !validateCompletedVideoIds(previous))
    return { error: 'Enable video-based progress from the current playlist first.' };
  if (typeof videoId !== 'string' || !VIDEO_ID.test(videoId))
    return { error: 'Select a valid YouTube lesson.' };
  if (action === 'complete-video') {
    if (previous.includes(videoId)) return { error: 'This lesson is already complete.' };
    if (previous.length >= MAX_IDS ||
        (current.totalVideos !== null && current.totalVideos !== undefined &&
          previous.length >= current.totalVideos))
      return { error: 'Completed videos cannot exceed the track limit.' };
    const ids = [...previous, videoId];
    return { value: { completedVideoIds: ids, completedVideos: ids.length, progressMode: 'videoIds' } };
  }
  if (action === 'undo-video') {
    if (!previous.includes(videoId)) return { error: 'This lesson is not marked complete.' };
    const ids = previous.filter((id) => id !== videoId);
    return { value: { completedVideoIds: ids, completedVideos: ids.length, progressMode: 'videoIds' } };
  }
  return { error: 'Unsupported lesson progress action.' };
}

export function buildIdentityLessonDays(videos, perDay, completedIds, startDate, buildDailyLessons) {
  if (!validateCompletedVideoIds(completedIds)) throw new TypeError('Invalid completed lessons.');
  // Only use the scheduling function to group and date videos; do not infer
  // identity completion from a positional count.
  const days = buildDailyLessons(videos, perDay, 0, startDate);
  const done = new Set(completedIds);
  return days.map((day) => ({ ...day, videos: day.videos.map((video) =>
    ({ ...video, completed: done.has(video.videoId) })) }));
}

export function currentIdentityLearningDay(days) {
  if (!Array.isArray(days)) throw new TypeError('Invalid study days.');
  const day = days.find((item) => item.videos.some((video) => !video.completed));
  if (!day) return null;
  const remaining = day.videos.filter((video) => !video.completed);
  return { day: day.day, date: day.date, remaining, next: remaining[0],
    completedInDay: day.videos.length - remaining.length,
    plannedInDay: day.videos.length };
}

/** Resolve the next lesson without silently converting positional progress. */
export function nextExtensionLesson(track, videos, currentVideoId = null) {
  if (!Array.isArray(videos) || !videos.length) throw new TypeError('Playlist is empty.');
  let done = new Set();
  if (track.progressMode === 'videoIds') {
    if (!validateCompletedVideoIds(track.completedVideoIds)) throw new TypeError('Invalid completed lessons.');
    done = new Set(track.completedVideoIds);
  } else if (track.completedVideos !== 0) {
    throw new TypeError('Review and enable video-specific progress in Oge before continuing from the extension.');
  }
  const currentIndex = currentVideoId ? videos.findIndex(video => video.videoId === currentVideoId) : -1;
  return videos.slice(currentIndex + 1).find(video => video.videoId !== currentVideoId && !done.has(video.videoId)) || null;
}

export function extensionLessonChange(track, videos, videoId, action) {
  if (!Array.isArray(videos) || !videos.some(v => v.videoId === videoId))
    return { error: 'Current video is not in this playlist.' };
  if (!['complete-video', 'undo-video'].includes(action))
    return { error: 'Unsupported lesson action.' };
  if (track.progressMode !== 'videoIds' && track.completedVideos !== 0)
    return { error: 'Review and enable video-specific progress in Oge first.' };
  const current = track.progressMode === 'videoIds' ? track :
    { ...track, progressMode: 'videoIds', completedVideoIds: [] };
  if (!validateCompletedVideoIds(current.completedVideoIds))
    return { error: 'Invalid saved progress.' };
  const already = current.completedVideoIds.includes(videoId);
  const change = (action === 'complete-video' ? already : !already)
    ? { value: { progressMode: 'videoIds', completedVideoIds: current.completedVideoIds, completedVideos: current.completedVideoIds.length } }
    : changeVideoCompletion(current, { action, videoId });
  if (change.error) return change;
  const updated = { ...current, ...change.value };
  return { value: change.value, next: action === 'complete-video' ? nextExtensionLesson(updated, videos, videoId) : null,
    hasUnfinished: Boolean(nextExtensionLesson(updated, videos)) };
}
