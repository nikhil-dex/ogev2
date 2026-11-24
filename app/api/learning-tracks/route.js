import { randomUUID } from 'node:crypto';
import { changeVideoCompletion } from '../../../lib/learning-track-video-progress.js';
import { learningTrackNoteLinksEnabled } from '../../../lib/oge-learning-track-note-links.js';
import { auth } from '../../../auth.js';
import { getDatabase } from '../../../lib/mongodb.js';
import { normalizeLearningTrack, normalizeTrackSchedule, publicLearningTrack } from '../../../lib/learning-tracks.js';
import { readLimitedBody } from '../../../lib/read-limited-body.js';
import { withActiveOwnerMutation } from '../../../lib/active-owner-mutation.js';
import { checkOwnerMutationLimit, rateLimitResponse } from '../../../lib/rate-limit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const enabled = () => process.env.OGE_LEARNING_TRACKS_PREVIEW === 'true';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const idValid = (id) => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);

async function context() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { db: await getDatabase(), ownerId: session.user.id, sessionVersion: session.user.sessionVersion };
}
async function requestBody(request) {
  try { return { value: JSON.parse(await readLimitedBody(request, 4096)) }; }
  catch (error) { return { error: json({ error: error?.status === 413 ? 'Request too large.' : 'Invalid JSON.' }, error?.status || 400) }; }
}
export async function GET() {
  if (!enabled()) return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  try {
    const ctx = await context();
    if (!ctx) return json({ error: 'Sign in to view learning tracks.' }, 401);
    const tracks = await ctx.db.collection('learningTracks').find({ ownerId: ctx.ownerId })
      .sort({ createdAt: -1 }).limit(100).toArray();
    return json({ tracks: tracks.map(publicLearningTrack), noteLinkingEnabled: learningTrackNoteLinksEnabled() });
  } catch (error) {
    console.error('Learning Tracks GET failed:', error?.name);
    return json({ error: 'Unable to read learning tracks.' }, 503);
  }
}
export async function POST(request) {
  if (!enabled()) return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const parsed = await requestBody(request);
  if (parsed.error) return parsed.error;
  const result = normalizeLearningTrack(parsed.value);
  if (result.error) return json({ error: result.error }, 400);
  try {
    const ctx = await context();
    if (!ctx) return json({ error: 'Sign in to create learning tracks.' }, 401);
    const throttle = await checkOwnerMutationLimit(ctx.db, ctx.ownerId, 'learning-tracks');
    if (!throttle.allowed) return rateLimitResponse(throttle);
    return await withActiveOwnerMutation(ctx.db, ctx.ownerId, async (session) => {
      const collection = ctx.db.collection('learningTracks');
      if (await collection.findOne({ ownerId: ctx.ownerId, playlistId: result.value.playlistId }, { session, projection: { _id: 1 } }))
        return json({ error: 'You already have a track for this playlist.' }, 409);
      if (await collection.countDocuments({ ownerId: ctx.ownerId }, { session }) >= 100)
        return json({ error: '100-track preview limit reached.' }, 409);
      const now = new Date();
      const track = { _id: randomUUID(), ownerId: ctx.ownerId, ...result.value, completedVideos: 0, createdAt: now, updatedAt: now };
      await collection.insertOne(track, { session });
      return json({ track: publicLearningTrack(track) }, 201);
    }, { sessionVersion: ctx.sessionVersion });
  } catch (error) {
    if (error?.code === 11000) return json({ error: 'You already have a track for this playlist.' }, 409);
    console.error('Learning Tracks POST failed:', error?.name);
    return json({ error: 'Could not create learning track.' }, 503);
  }
}
export async function PATCH(request) {
  if (!enabled()) return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const parsed = await requestBody(request);
  if (parsed.error) return parsed.error;
  const { id, expectedCompleted, completedVideos, action } = parsed.value || {};
  if (action) return updateIdentityProgress(parsed.value);
  if (!idValid(id) || !Number.isInteger(expectedCompleted) || expectedCompleted < 0 ||
      !Number.isInteger(completedVideos) || completedVideos < 0 || completedVideos > 10000 ||
      Math.abs(completedVideos - expectedCompleted) !== 1)
    return json({ error: 'Provide a valid one-video progress update.' }, 400);
  try {
    const ctx = await context();
    if (!ctx) return json({ error: 'Sign in to update learning tracks.' }, 401);
    const throttle = await checkOwnerMutationLimit(ctx.db, ctx.ownerId, 'learning-tracks');
    if (!throttle.allowed) return rateLimitResponse(throttle);
    return await withActiveOwnerMutation(ctx.db, ctx.ownerId, async (session) => {
      const collection = ctx.db.collection('learningTracks');
      const track = await collection.findOne({ _id: id, ownerId: ctx.ownerId }, { session });
      if (!track) return json({ error: 'Learning track not found.' }, 404);
      if (track.progressMode === 'videoIds')
        return json({ error: 'Use video-specific completion for this track.' }, 409);
      if (track.completedVideos !== expectedCompleted) return json({ error: 'Progress changed on another device. Refresh and try again.' }, 409);
      if (track.totalVideos !== null && completedVideos > track.totalVideos)
        return json({ error: 'Completed videos cannot exceed the total.' }, 400);
      const updatedAt = new Date();
      const update = await collection.updateOne(
        { _id: id, ownerId: ctx.ownerId, completedVideos: expectedCompleted },
        { $set: { completedVideos, updatedAt } }, { session });
      if (update.matchedCount !== 1) return json({ error: 'Progress changed. Refresh and try again.' }, 409);
      return json({ track: publicLearningTrack({ ...track, completedVideos, updatedAt }) });
    }, { sessionVersion: ctx.sessionVersion });
  } catch (error) {
    console.error('Learning Tracks PATCH failed:', error?.name);
    return json({ error: 'Could not update learning progress.' }, 503);
  }
}
// Separate discriminated progress action. Legacy count tracks are preserved
// until the owner explicitly confirms a conversion from a discovered snapshot.
async function updateIdentityProgress(data) {
  const { id, action, expectedUpdatedAt, expectedCompleted } = data || {};
  if (!idValid(id) || !['adopt-video-ids', 'complete-video', 'undo-video'].includes(action) ||
      typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt)))
    return json({ error: 'Select a valid track and refresh progress.' }, 400);
  try {
    const ctx = await context();
    if (!ctx) return json({ error: 'Sign in to update lessons.' }, 401);
    const throttle = await checkOwnerMutationLimit(ctx.db, ctx.ownerId, 'learning-tracks');
    if (!throttle.allowed) return rateLimitResponse(throttle);
    return await withActiveOwnerMutation(ctx.db, ctx.ownerId, async (session) => {
      const collection = ctx.db.collection('learningTracks');
      const track = await collection.findOne({ _id: id, ownerId: ctx.ownerId }, { session });
      if (!track) return json({ error: 'Learning track not found.' }, 404);
      if (new Date(track.updatedAt).toISOString() !== expectedUpdatedAt)
        return json({ error: 'Progress changed elsewhere. Refresh before editing.' }, 409);
      const change = changeVideoCompletion(track, {
        action, expectedCompleted, videoId: data.videoId, videoIds: data.videoIds,
      });
      if (change.error) return json({ error: change.error }, 400);
      const updatedAt = new Date(Math.max(Date.now(), new Date(track.updatedAt).getTime() + 1));
      const updated = await collection.updateOne(
        { _id: id, ownerId: ctx.ownerId, updatedAt: track.updatedAt },
        { $set: { ...change.value, updatedAt } }, { session });
      if (updated.matchedCount !== 1)
        return json({ error: 'Progress changed elsewhere. Refresh before editing.' }, 409);
      return json({ track: publicLearningTrack({ ...track, ...change.value, updatedAt }) });
    }, { sessionVersion: ctx.sessionVersion });
  } catch (error) {
    console.error('Learning Tracks video progress failed:', error?.name);
    return json({ error: 'Could not update video completion. Refresh before retrying.' }, 503);
  }
}

// Update one track's plan without rewriting its completed-video count.
export async function PUT(request) {
  if (!enabled()) return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const parsed = await requestBody(request);
  if (parsed.error) return parsed.error;
  const { id, expectedUpdatedAt } = parsed.value || {};
  const plan = normalizeTrackSchedule(parsed.value);
  if (!idValid(id) || typeof expectedUpdatedAt !== 'string' ||
      !Number.isFinite(Date.parse(expectedUpdatedAt)) || plan.error)
    return json({ error: plan.error || 'Select a track and refresh its plan before saving.' }, 400);
  try {
    const ctx = await context();
    if (!ctx) return json({ error: 'Sign in to change your learning plan.' }, 401);
    const throttle = await checkOwnerMutationLimit(ctx.db, ctx.ownerId, 'learning-tracks');
    if (!throttle.allowed) return rateLimitResponse(throttle);
    return await withActiveOwnerMutation(ctx.db, ctx.ownerId, async (session) => {
      const collection = ctx.db.collection('learningTracks');
      const track = await collection.findOne({ _id: id, ownerId: ctx.ownerId }, { session });
      if (!track) return json({ error: 'Learning track not found.' }, 404);
      if (new Date(track.updatedAt).toISOString() !== expectedUpdatedAt)
        return json({ error: 'Track changed on another device. Refresh before changing its plan.' }, 409);
      const updatedAt = new Date();
      const result = await collection.updateOne(
        { _id: id, ownerId: ctx.ownerId, updatedAt: track.updatedAt },
        { $set: { ...plan.value, updatedAt } }, { session });
      if (result.matchedCount !== 1)
        return json({ error: 'Track changed. Refresh before saving its plan.' }, 409);
      return json({ track: publicLearningTrack({ ...track, ...plan.value, updatedAt }) });
    }, { sessionVersion: ctx.sessionVersion });
  } catch (error) {
    console.error('Learning Tracks plan PUT failed:', error?.name);
    return json({ error: 'Could not save the learning plan.' }, 503);
  }
}

export async function DELETE(request) {
  if (!enabled()) return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const id = new URL(request.url).searchParams.get('id');
  if (!idValid(id)) return json({ error: 'Select a valid learning track.' }, 400);
  try {
    const ctx = await context();
    if (!ctx) return json({ error: 'Sign in to remove learning tracks.' }, 401);
    const throttle = await checkOwnerMutationLimit(ctx.db, ctx.ownerId, 'learning-tracks');
    if (!throttle.allowed) return rateLimitResponse(throttle);
    return await withActiveOwnerMutation(ctx.db, ctx.ownerId, async (session) => {
      const result = await ctx.db.collection('learningTracks').deleteOne({ _id: id, ownerId: ctx.ownerId }, { session });
      if (result.deletedCount) await ctx.db.collection('learningTrackNoteLinks').deleteMany({ ownerId: ctx.ownerId, trackId: id }, { session });
      return result.deletedCount ? json({ deleted: id }) : json({ error: 'Learning track not found.' }, 404);
    }, { sessionVersion: ctx.sessionVersion });
  } catch (error) {
    console.error('Learning Tracks DELETE failed:', error?.name);
    return json({ error: 'Could not remove learning track.' }, 503);
  }
}
