import { nextExtensionLesson } from '../../../../lib/learning-track-video-progress.js';
import { discoverPublicPlaylist, PlaylistDiscoveryError } from '../../../../lib/youtube-playlist-discovery.js';
import { randomUUID } from 'node:crypto';
import { hashExtensionToken } from '../../../../lib/extension-token.js';
import { normalizeLearningTrack, publicLearningTrack } from '../../../../lib/learning-tracks.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { readLimitedBody } from '../../../../lib/read-limited-body.js';
import { withActiveOwnerMutation } from '../../../../lib/active-owner-mutation.js';
import { checkRateLimit, rateLimitResponse } from '../../../../lib/rate-limit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = {
  'Cache-Control': 'private, no-store', 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Vary': 'Origin',
};
const json = (data, status = 200) => Response.json(data, { status, headers: HEADERS });
export function OPTIONS() { return new Response(null, { status: 204, headers: HEADERS }); }
export async function POST(request) {
  if (process.env.OGE_LEARNING_TRACKS_PREVIEW !== 'true') return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!/^oge_[A-Za-z0-9_-]{40,60}$/.test(token)) return json({ error: 'A valid extension token is required.' }, 401);
  let data;
  try { data = JSON.parse(await readLimitedBody(request, 4096)); }
  catch (error) { return json({ error: error?.status === 413 ? 'Request too large.' : 'Invalid JSON.' }, error?.status || 400); }
  const normalized = normalizeLearningTrack(data);
  if (normalized.error) return json({ error: normalized.error }, 400);
  const tokenHash = hashExtensionToken(token);
  try {
    const db = await getDatabase();
    const limit = await checkRateLimit(db, { scope: 'extension-learning-track', identifier: tokenHash, limit: 30, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return rateLimitResponse(limit);
    const user = await db.collection('users').findOne(
      { extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } },
      { projection: { googleSub: 1 } });
    if (!user?.googleSub) return json({ error: 'Extension connection expired or revoked.' }, 401);
    if (!process.env.OGE_YOUTUBE_DATA_API_KEY)
      return json({ error: 'YouTube playlist discovery requires a server-side API key.' }, 503);
    const discoveryLimit = await checkRateLimit(db, { scope: 'learning-track-discover', identifier: user.googleSub, limit: 5, windowMs: 60 * 60 * 1000 });
    if (!discoveryLimit.allowed) return rateLimitResponse(discoveryLimit);
    const snapshot = await discoverPublicPlaylist(normalized.value.playlistId, process.env.OGE_YOUTUBE_DATA_API_KEY);
    return await withActiveOwnerMutation(db, user.googleSub, async (session) => {
      const live = await db.collection('users').findOne({
        googleSub: user.googleSub, extensionTokenHash: tokenHash,
        extensionTokenExpiresAt: { $gt: new Date() },
      }, { session, projection: { _id: 1 } });
      if (!live) return json({ error: 'Extension connection expired or revoked.' }, 401);
      const collection = db.collection('learningTracks');
      if (await collection.findOne({ ownerId: user.googleSub, playlistId: normalized.value.playlistId }, { session, projection: { _id: 1 } }))
        return json({ error: 'You already have a track for this playlist.' }, 409);
      if (await collection.countDocuments({ ownerId: user.googleSub }, { session }) >= 100)
        return json({ error: '100-track preview limit reached.' }, 409);
      const now = new Date();
      const track = { _id: randomUUID(), ownerId: user.googleSub, ...normalized.value, totalVideos: snapshot.totalVideos, progressMode: 'videoIds', completedVideoIds: [], completedVideos: 0, createdAt: now, updatedAt: now };
      await collection.insertOne(track, { session });
      return json({ track: publicLearningTrack(track) }, 201);
    }, { extensionTokenHash: tokenHash });
  } catch (error) {
    if (error instanceof PlaylistDiscoveryError) return json({ error: error.message }, error.status);
    if (error?.code === 11000) return json({ error: 'You already have a track for this playlist.' }, 409);
    console.error('Extension Learning Tracks POST failed:', error?.name);
    return json({ error: 'Could not create learning track.' }, 503);
  }
}

export async function GET(request) {
  if (process.env.OGE_LEARNING_TRACKS_PREVIEW !== 'true') return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!/^oge_[A-Za-z0-9_-]{40,60}$/.test(token)) return json({ error: 'A valid extension token is required.' }, 401);
  try {
    const db = await getDatabase();
    const tokenHash = hashExtensionToken(token);
    const limit = await checkRateLimit(db, { scope: 'extension-learning-track-list', identifier: tokenHash, limit: 120, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return rateLimitResponse(limit);
    const user = await db.collection('users').findOne(
      { extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } },
      { projection: { googleSub: 1 } });
    if (!user?.googleSub) return json({ error: 'Extension connection expired or revoked.' }, 401);
    const id = new URL(request.url).searchParams.get('next');
    if (id !== null) {
      if (!/^[a-f0-9-]{36}$/i.test(id)) return json({ error: 'Select a valid track.' }, 400);
      const track = await db.collection('learningTracks').findOne({ _id: id, ownerId: user.googleSub });
      if (!track) return json({ error: 'Learning track not found.' }, 404);
      if (track.progressMode !== 'videoIds' && track.completedVideos !== 0)
        return json({ error: 'Review and enable video-specific progress in Oge first.' }, 409);
      if (!process.env.OGE_YOUTUBE_DATA_API_KEY)
        return json({ error: 'YouTube playlist discovery requires a server-side API key.' }, 503);
      const discoveryLimit = await checkRateLimit(db, { scope: 'learning-track-discover', identifier: user.googleSub, limit: 5, windowMs: 60 * 60 * 1000 });
      if (!discoveryLimit.allowed) return rateLimitResponse(discoveryLimit);
      const snapshot = await discoverPublicPlaylist(track.playlistId, process.env.OGE_YOUTUBE_DATA_API_KEY);
      const live = await db.collection('users').findOne(
        { googleSub: user.googleSub, extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } },
        { projection: { _id: 1 } });
      if (!live) return json({ error: 'Extension connection expired or revoked.' }, 401);
      const current = await db.collection('learningTracks').findOne({ _id: id, ownerId: user.googleSub });
      if (!current || current.playlistId !== track.playlistId) return json({ error: 'Track changed. Refresh and retry.' }, 409);
      if (current.progressMode !== 'videoIds' && current.completedVideos !== 0)
        return json({ error: 'Review and enable video-specific progress in Oge first.' }, 409);
      const params = new URL(request.url).searchParams;
      const currentVideoId = params.get('video');
      const currentPlaylistId = params.get('playlist');
      const next = nextExtensionLesson(current, snapshot.videos,
        currentPlaylistId === current.playlistId ? currentVideoId : null);
      return json({ next: next ? { videoId: next.videoId, title: next.title, playlistId: current.playlistId } : null,
        hasUnfinished: Boolean(nextExtensionLesson(current, snapshot.videos)), totalVideos: snapshot.totalVideos });
    }
    const tracks = await db.collection('learningTracks').find({ ownerId: user.googleSub })
      .sort({ createdAt: -1 }).limit(100).toArray();
    const live = await db.collection('users').findOne(
      { googleSub: user.googleSub, extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } },
      { projection: { _id: 1 } });
    if (!live) return json({ error: 'Extension connection expired or revoked.' }, 401);
    return json({ tracks: tracks.map(track => ({
      id: String(track._id), title: track.title, videosPerDay: track.videosPerDay,
      completedVideos: track.completedVideos, totalVideos: track.totalVideos ?? null,
    })) });
  } catch (error) {
    if (error instanceof PlaylistDiscoveryError) return json({ error: error.message }, error.status);
    console.error('Extension Learning Tracks GET failed:', error?.name);
    return json({ error: 'Could not load learning tracks.' }, 503);
  }
}
