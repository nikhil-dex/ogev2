import { createHash } from 'node:crypto';

export function learningCaptureIds(ownerId, trackId, subjectSlug, topicKey) {
  const hash = createHash('sha256').update(JSON.stringify(['oge-learning-note-v1', ownerId, trackId, subjectSlug, topicKey])).digest('hex');
  const uuid = hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
  return { vaultId: uuid, mongoId: hash.slice(0,24) };
}
