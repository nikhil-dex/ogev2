import { nextExtensionLesson, extensionLessonChange } from '../../../../lib/learning-track-video-progress.js';
import { cachedPublicPlaylist } from '../../../../lib/youtube-playlist-cache.js';
import { PlaylistDiscoveryError } from '../../../../lib/youtube-playlist-discovery.js';
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
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
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
    const snapshot = await cachedPublicPlaylist(db, normalized.value.playlistId, user.googleSub);
    return await withActiveOwnerMutation(db, user.googleSub, async (session) => {
      const live = await db.collection('users').findOne({
        googleSub: user.googleSub, extensionTokenHash: tokenHash,
        extensionTokenExpiresAt: { $gt: new Date() },
      }, { session, projection: { _id: 1 } });
      if (!live) return json({ error: 'Extension connection expired or revoked.' }, 401);
      const collection = db.collection('learningTracks');
      if (normalized.value.subjectSlug && !await db.collection('subjects').findOne({ ownerId: user.googleSub, slug: normalized.value.subjectSlug }, { session })) return json({ error: 'Subject not found.' }, 404);
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
      const snapshot = await cachedPublicPlaylist(db, track.playlistId, user.googleSub);
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
        hasUnfinished: Boolean(nextExtensionLesson(current, snapshot.videos)), totalVideos: snapshot.totalVideos, stale: snapshot.stale, fetchedAt: snapshot.fetchedAt });
    }
    const tracks = await db.collection('learningTracks').find({ ownerId: user.googleSub })
      .sort({ createdAt: -1 }).limit(100).toArray();
    const live = await db.collection('users').findOne(
      { googleSub: user.googleSub, extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } },
      { projection: { _id: 1 } });
    if (!live) return json({ error: 'Extension connection expired or revoked.' }, 401);
    return json({ tracks: tracks.map(track => ({
      id: String(track._id), playlistId: track.playlistId, subjectSlug: track.subjectSlug || '', title: track.title, videosPerDay: track.videosPerDay,
      completedVideos: track.completedVideos, totalVideos: track.totalVideos ?? null,
    })) });
  } catch (error) {
    if (error instanceof PlaylistDiscoveryError) return json({ error: error.message }, error.status);
    console.error('Extension Learning Tracks GET failed:', error?.name);
    return json({ error: 'Could not load learning tracks.' }, 503);
  }
}

export async function PATCH(request) {
  if (process.env.OGE_LEARNING_TRACKS_PREVIEW !== 'true') return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!/^oge_[A-Za-z0-9_-]{40,60}$/.test(token)) return json({ error: 'A valid extension token is required.' }, 401);
  let data;
  try { data = JSON.parse(await readLimitedBody(request, 4096)); }
  catch (error) { return json({ error: 'Invalid progress request.' }, error?.status || 400); }
  const { id, videoId, playlistId, action } = data || {};
  if (action === 'refresh-playlist') return refreshTrack(token, id);
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) ||
      typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId) ||
      typeof playlistId !== 'string' || !/^[A-Za-z0-9_-]{10,120}$/.test(playlistId) ||
      !['complete-video', 'undo-video'].includes(action))
    return json({ error: 'Open a video in the selected playlist first.' }, 400);
  const tokenHash = hashExtensionToken(token);
  try {
    const db = await getDatabase();
    const user = await db.collection('users').findOne({ extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } }, { projection: { googleSub: 1 } });
    if (!user?.googleSub) return json({ error: 'Extension connection expired or revoked.' }, 401);
    const track = await db.collection('learningTracks').findOne({ _id: id, ownerId: user.googleSub, playlistId });
    if (!track) return json({ error: 'Current playlist does not match this track.' }, 404);
    if (track.progressMode !== 'videoIds' && track.completedVideos !== 0)
      return json({ error: 'Review and enable video-specific progress in Oge first.' }, 409);
    if (!process.env.OGE_YOUTUBE_DATA_API_KEY) return json({ error: 'YouTube discovery is not configured.' }, 503);
    const snapshot = await cachedPublicPlaylist(db, playlistId, user.googleSub);
    return await withActiveOwnerMutation(db, user.googleSub, async session => {
      const live = await db.collection('users').findOne({ googleSub: user.googleSub, extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } }, { session, projection: { _id: 1 } });
      if (!live) return json({ error: 'Extension connection expired or revoked.' }, 401);
      const collection = db.collection('learningTracks');
      const current = await collection.findOne({ _id: id, ownerId: user.googleSub, playlistId }, { session });
      if (!current) return json({ error: 'Track changed. Refresh and retry.' }, 409);
      const change = extensionLessonChange({ ...current, totalVideos: Math.max(snapshot.totalVideos, current.completedVideos + 1) }, snapshot.videos, videoId, action);
      if (change.error) return json({ error: change.error }, 409);
      const updatedAt = new Date(Math.max(Date.now(), new Date(current.updatedAt).getTime() + 1));
      const result = await collection.updateOne({ _id: id, ownerId: user.googleSub, updatedAt: current.updatedAt },
        { $set: { ...change.value, ...(snapshot.stale ? {} : { totalVideos: snapshot.totalVideos }), updatedAt } }, { session });
      if (result.matchedCount !== 1) return json({ error: 'Progress changed. Refresh and retry.' }, 409);
      return json({ saved: true, completedVideos: change.value.completedVideos, totalVideos: snapshot.totalVideos,
        next: change.next ? { videoId: change.next.videoId, title: change.next.title, playlistId } : null,
        hasUnfinished: change.hasUnfinished, stale: snapshot.stale, fetchedAt: snapshot.fetchedAt });
    }, { extensionTokenHash: tokenHash });
  } catch (error) {
    if (error instanceof PlaylistDiscoveryError) return json({ error: error.message }, error.status);
    console.error('Extension lesson progress failed:', error?.name);
    return json({ error: 'Could not confirm progress. Refresh before retrying.' }, 503);
  }
}

async function refreshTrack(token, id) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) return json({ error: 'Select a valid track.' }, 400);
  const tokenHash = hashExtensionToken(token);
  try {
    const db = await getDatabase();
    const user = await db.collection('users').findOne({ extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } }, { projection: { googleSub: 1 } });
    if (!user?.googleSub) return json({ error: 'Extension connection expired or revoked.' }, 401);
    const limit = await checkRateLimit(db, { scope: 'extension-track-refresh', identifier: tokenHash, limit: 30, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return rateLimitResponse(limit);
    const tracks = db.collection('learningTracks');
    const track = await tracks.findOne({ _id: id, ownerId: user.googleSub });
    if (!track) return json({ error: 'Learning track not found.' }, 404);
    const snapshot = await cachedPublicPlaylist(db, track.playlistId, user.googleSub, { refresh: true });
    return await withActiveOwnerMutation(db, user.googleSub, async session => {
      const live = await db.collection('users').findOne({ googleSub: user.googleSub, extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() } }, { session, projection: { _id: 1 } });
      if (!live) return json({ error: 'Extension connection expired or revoked.' }, 401);
      const current = await tracks.findOne({ _id: id, ownerId: user.googleSub, playlistId: track.playlistId }, { session });
      if (!current) return json({ error: 'Track changed. Refresh and retry.' }, 409);
      // Never overwrite a saved count from stale fallback or discard historical completions.
      const count = snapshot.stale ? current.totalVideos : snapshot.totalVideos;
      if (count !== current.totalVideos) {
        const updatedAt = new Date(Math.max(Date.now(), new Date(current.updatedAt).getTime() + 1));
        const result = await tracks.updateOne({ _id: id, ownerId: user.googleSub, updatedAt: current.updatedAt }, { $set: { totalVideos: count, updatedAt } }, { session });
        if (result.matchedCount !== 1) return json({ error: 'Track changed. Refresh and retry.' }, 409);
      }
      return json({ totalVideos: count ?? null, completedVideos: current.completedVideos, stale: snapshot.stale, fetchedAt: snapshot.fetchedAt });
    }, { extensionTokenHash: tokenHash });
  } catch (error) {
    if (error instanceof PlaylistDiscoveryError) return json({ error: error.message }, error.status);
    console.error('Extension playlist refresh failed:', error?.name);
    return json({ error: 'Could not refresh playlist.' }, 503);
  }
}
