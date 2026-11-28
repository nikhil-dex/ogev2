// Topic identity is independent of display name and playlist position.
const VIDEO = /^[A-Za-z0-9_-]{11}$/;
const ID = /^[a-f0-9-]{36}$/i;
export function lessonTopic(track, video) {
  const topic = (track.topics || []).find(item => item.videoIds.includes(video.videoId));
  return topic ? { key: 'topic:' + topic.id, title: topic.title } : { key: 'video:' + video.videoId, title: video.title };
}
export function changeTrackTopics(track, input, videos, newId) {
  const topics = (track.topics || []).map(topic => ({ ...topic, videoIds: [...topic.videoIds] }));
  if (!['assign-topic', 'rename-topic', 'merge-topic', 'clear-topic'].includes(input?.action)) return { error: 'Invalid topic action.' };
  const title = typeof input.title === 'string' ? input.title.trim().replace(/\s+/g, ' ') : '';
  const target = topics.find(topic => topic.id === input.topicId);
  if (input.action === 'rename-topic') {
    if (!target || !title || title.length > 120) return { error: 'Choose a topic and valid name.' };
    target.title = title;
  } else if (input.action === 'merge-topic') {
    const source = topics.find(topic => topic.id === input.sourceTopicId);
    if (!target || !source || target === source) return { error: 'Choose two different topics.' };
    target.videoIds = [...new Set([...target.videoIds, ...source.videoIds])];
    source.videoIds = [];
  } else {
    const ids = input.videoIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 500 || new Set(ids).size !== ids.length ||
        !ids.every(id => typeof id === 'string' && VIDEO.test(id) && videos.some(video => video.videoId === id)))
      return { error: 'Select lessons from the current playlist.' };
    if (input.action === 'assign-topic' && !target && (input.topicId || !title || title.length > 120 || !ID.test(newId || '')))
      return { error: 'Choose an existing topic or enter a new name.' };
    for (const topic of topics) topic.videoIds = topic.videoIds.filter(id => !ids.includes(id));
    if (input.action === 'assign-topic') {
      if (target) target.videoIds.push(...ids);
      else topics.push({ id: newId, title, videoIds: [...ids] });
    }
  }
  const result = topics.filter(topic => topic.videoIds.length);
  if (result.length > 500 || result.reduce((sum, topic) => sum + topic.videoIds.length, 0) > 500)
    return { error: 'Topic mapping limit reached.' };
  return { value: result };
}
