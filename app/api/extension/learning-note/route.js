import { ObjectId } from 'mongodb';
import { hashExtensionToken } from '../../../../lib/extension-token.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { readLimitedBody } from '../../../../lib/read-limited-body.js';
import { checkRateLimit, rateLimitResponse } from '../../../../lib/rate-limit.js';
import { withActiveOwnerMutation } from '../../../../lib/active-owner-mutation.js';
import { inspectLegacyCutoverForOwner, legacyCutoverBlockedResponse } from '../../../../lib/oge-vault-cutover-guard.js';
import { vaultCaptureAvailable } from '../../../../lib/oge-vault-workspace-routing.js';
import { getVaultNoteClient, readVaultNote } from '../../../../lib/oge-vault-notes.js';
import { VaultGitHubError } from '../../../../lib/oge-vault-github.js';
import { cachedPublicPlaylist } from '../../../../lib/youtube-playlist-cache.js';
import { lessonTopic } from '../../../../lib/learning-track-topics.js';
import { learningCaptureIds } from '../../../../lib/learning-track-capture.js';
import { lessonSourceCapture, normalizePlaybackSeconds } from '../../../../lib/learning-track-source.js';
import { POST as createVaultNote } from '../vault-note/route.js';
import { POST as appendNote } from '../notes/route.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = { 'Cache-Control': 'private, no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', Vary: 'Origin' };
const json = (data, status = 200) => Response.json(data, { status, headers: HEADERS });
export const OPTIONS = () => new Response(null, { status: 204, headers: HEADERS });

export async function POST(request) {
  if (process.env.OGE_LEARNING_TRACKS_PREVIEW !== 'true') return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!/^oge_[A-Za-z0-9_-]{40,60}$/.test(token)) return json({ error: 'Connect the Oge extension first.' }, 401);
  let data;
  try { data = JSON.parse(await readLimitedBody(request, 96 * 1024)); }
  catch (error) { return json({ error: 'Invalid capture request.' }, error?.status || 400); }
  const { id, videoId, playlistId } = data || {};
  const content = typeof data?.content === 'string' ? data.content.replace(/\r\n?/g, '\n').trim() : '';
  const lookup = data?.mode === 'lookup';
  if ((!lookup && !content) || content.length > 19800 || typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) ||
      typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId) ||
      typeof playlistId !== 'string' || !/^[A-Za-z0-9_-]{10,120}$/.test(playlistId))
    return json({ error: 'Open a tracked lesson and write something before saving.' }, 400);
  try {
    const db = await getDatabase();
    const tokenHash = hashExtensionToken(token);
    const owner = await db.collection('users').findOne({ extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } },
      { projection: { googleSub: 1, sessionVersion: 1, notesStorage: 1, vault: 1 } });
    if (!owner?.googleSub) return json({ error: 'Extension connection expired.' }, 401);
    const limit = await checkRateLimit(db, { scope: 'extension-learning-capture', identifier: tokenHash, limit: 40, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return rateLimitResponse(limit);
    const tracks = db.collection('learningTracks');
    const track = await tracks.findOne({ _id: id, ownerId: owner.googleSub, playlistId });
    if (!track?.subjectSlug) return json({ error: 'Assign a Notes subject to this track in Oge first.' }, 409);
    const subject = await db.collection('subjects').findOne({ ownerId: owner.googleSub, slug: track.subjectSlug });
    if (!subject) return json({ error: 'Choose an available Notes subject.' }, 404);
    const snapshot = await cachedPublicPlaylist(db, playlistId, owner.googleSub);
    if (snapshot.stale) return json({ error: 'Refresh this playlist before creating a lesson Note.' }, 409);
    const video = snapshot.videos.find(item => item.videoId === videoId);
    if (!video) return json({ error: 'Current video is not in this playlist.' }, 409);
    const topic = lessonTopic(track, video);
    const heading = topic.title.trim().slice(0, 160);
    const destination = (existing, version, storage) => ({ existing: Boolean(existing), id: existing?.id || null, title: existing?.heading || heading, version: version || null, subjectSlug: track.subjectSlug, subject: subject.name, destination: storage, videoId, topicKey: topic.key });
    const playbackSeconds = normalizePlaybackSeconds(data.playbackSeconds);
    const firstCapture = lookup ? '' : lessonSourceCapture(content, video, '', playbackSeconds);
    if (!lookup && firstCapture.length > 20000) return json({ error: 'Lesson Note and its source exceed 20,000 characters.' }, 400);
    const appendRequest = (noteId, version, previous) => appendNote(new Request(request.url, { method: 'POST', headers: { authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ noteId, version, subjectSlug: track.subjectSlug, content: lessonSourceCapture(content, video, previous, playbackSeconds) }) }));
    if (!lookup && (data.expectedTopicKey !== topic.key || data.expectedSubjectSlug !== track.subjectSlug || data.expectedVideoId !== videoId)) return json({ error: 'Lesson topic changed. Reopen the lesson Note destination.' }, 409);
    const ids = learningCaptureIds(owner.googleSub, id, track.subjectSlug, topic.key);
    const current = await tracks.findOne({ _id: id, ownerId: owner.googleSub, updatedAt: track.updatedAt });
    if (!current) return json({ error: 'Track changed. Refresh before saving.' }, 409);
    if (vaultCaptureAvailable(owner)) {
      const client = await getVaultNoteClient(db, { ownerId: owner.googleSub, sessionVersion: owner.sessionVersion ?? 0 });
      let existing;
      try { existing = await readVaultNote(client, ids.vaultId); }
      catch (error) { if (!(error instanceof VaultGitHubError && error.status === 404)) throw error; }
      if (existing) {
        if (existing.subjectId !== track.subjectSlug) return json({ error: 'Existing topic Note belongs to another subject.' }, 409);
        if (lookup) return json(destination(existing, existing.sha, 'vault'));
        if (data.expectedVersion === existing.sha && data.expectedNoteId === existing.id) return appendRequest(existing.id, existing.sha, existing.answer);
        if (data.expectedVersion == null && existing.heading === heading && existing.answer === firstCapture)
          return json({ confirmed: true, id: existing.id, title: existing.heading, version: existing.sha, destination: 'vault', alreadySaved: true });
        return json({ error: 'Topic Note changed or already exists. Reopen the destination before saving.' }, 409);
      }
      if (lookup) return json(destination(null, null, 'vault'));
      if (data.expectedVersion != null) return json({ error: 'Topic Note is no longer available. Reopen the destination.' }, 409);
      // Reuse the existing explicit GitHub Note writer, with a deterministic capture ID.
      const response = await createVaultNote(new Request(request.url, { method: 'POST', headers: { authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: heading + '\n' + firstCapture, subjectSlug: track.subjectSlug, captureId: ids.vaultId }) }));
      return response;
    }
    if (owner.notesStorage === 'github' || owner.notesStorage === 'unselected')
      return json({ error: 'Connect your selected Notes storage before saving.' }, 409);
    if (lookup) {
      const cutover = await inspectLegacyCutoverForOwner(db, owner.googleSub, { extensionTokenHash: tokenHash });
      if (cutover.blocked) return legacyCutoverBlockedResponse(cutover, { headers: HEADERS });
      const existing = await db.collection('notes').findOne({ _id: new ObjectId(ids.mongoId), ownerId: owner.googleSub, subjectSlug: track.subjectSlug }, { projection: { heading: 1, updatedAt: 1, createdAt: 1 } });
      return json(destination(existing ? { id: ids.mongoId, heading: existing.heading } : null, existing ? new Date(existing.updatedAt || existing.createdAt).toISOString() : null, 'notes'));
    }
    if (data.expectedVersion != null) {
      if (data.expectedNoteId !== ids.mongoId) return json({ error: 'Topic Note destination changed.' }, 409);
      const previous = await db.collection('notes').findOne({ _id: new ObjectId(ids.mongoId), ownerId: owner.googleSub, subjectSlug: track.subjectSlug });
      if (!previous || new Date(previous.updatedAt || previous.createdAt).toISOString() !== data.expectedVersion)
        return json({ error: 'Topic Note changed. Reopen the destination before saving.' }, 409);
      return appendRequest(ids.mongoId, data.expectedVersion, previous.answer);
    }
    return await withActiveOwnerMutation(db, owner.googleSub, async session => {
      const cutover = await inspectLegacyCutoverForOwner(db, owner.googleSub, { extensionTokenHash: tokenHash }, { session });
      if (cutover.blocked) return legacyCutoverBlockedResponse(cutover, { headers: HEADERS });
      const liveTrack = await tracks.findOne({ _id: id, ownerId: owner.googleSub, updatedAt: track.updatedAt }, { session });
      const liveSubject = await db.collection('subjects').findOne({ ownerId: owner.googleSub, slug: track.subjectSlug }, { session });
      if (!liveTrack || !liveSubject) return json({ error: 'Track or subject changed. Refresh before saving.' }, 409);
      const notes = db.collection('notes');
      const noteId = new ObjectId(ids.mongoId);
      const existing = await notes.findOne({ _id: noteId, ownerId: owner.googleSub, subjectSlug: track.subjectSlug }, { session });
      if (existing) {
        const result = { id: ids.mongoId, title: existing.heading, version: new Date(existing.updatedAt || existing.createdAt).toISOString(), subjectSlug: track.subjectSlug, destination: 'notes' };
        if (existing.heading === heading && existing.answer === firstCapture) return json({ ...result, confirmed: true, alreadySaved: true });
        return json({ error: 'Topic Note already exists. Reopen the destination before saving.' }, 409);
      }
      const now = new Date();
      await notes.insertOne({ _id: noteId, ownerId: owner.googleSub, subjectSlug: track.subjectSlug, heading, answer: firstCapture, tags: [], favorite: false, createdAt: now, updatedAt: now, revisions: [] }, { session });
      return json({ id: ids.mongoId, title: heading, destination: 'notes', confirmed: true, version: now.toISOString() }, 201);
    }, { extensionTokenHash: tokenHash });
  } catch (error) {
    console.error('Learning lesson Note creation failed:', error?.name);
    return json({ error: 'Lesson Note Save was not confirmed. Keep your editor text and retry.' }, 503);
  }
}
