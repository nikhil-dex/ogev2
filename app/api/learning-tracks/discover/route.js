import { auth } from '../../../../auth.js';
import { withActiveOwnerMutation } from '../../../../lib/active-owner-mutation.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { cachedPublicPlaylist } from '../../../../lib/youtube-playlist-cache.js';
import { PlaylistDiscoveryError } from '../../../../lib/youtube-playlist-discovery.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(request) {
  if (process.env.OGE_LEARNING_TRACKS_PREVIEW !== 'true')
    return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[a-f0-9-]{36}$/i.test(id))
    return json({ error: 'Select a valid learning track.' }, 400);
  const session = await auth();
  if (!session?.user?.id) return json({ error: 'Sign in to discover playlists.' }, 401);
  if (!process.env.OGE_YOUTUBE_DATA_API_KEY)
    return json({ error: 'Public playlist discovery requires a server-side YouTube Data API key.' }, 503);
  try {
    const db = await getDatabase();
    const track = await db.collection('learningTracks').findOne(
      { _id: id, ownerId: session.user.id },
      { projection: { playlistId: 1, title: 1 } },
    );
    if (!track) return json({ error: 'Learning track not found.' }, 404);
    const result = await cachedPublicPlaylist(db, track.playlistId, session.user.id, {
      refresh: new URL(request.url).searchParams.get('refresh') === '1',
    });
    return json({ ...result, playlistId: track.playlistId });
  } catch (error) {
    if (error instanceof PlaylistDiscoveryError)
      return json({ error: error.message }, error.status);
    console.error('Learning Tracks discovery failed:', error?.name);
    return json({ error: 'Playlist discovery is unavailable.' }, 503);
  }
}

export async function POST(request) {
  if (process.env.OGE_LEARNING_TRACKS_PREVIEW !== 'true') return json({ error: 'Learning Tracks preview is disabled.' }, 404);
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return json({ error: 'Select a valid track.' }, 400);
  const session = await auth();
  if (!session?.user?.id) return json({ error: 'Sign in to refresh playlists.' }, 401);
  try {
    const db = await getDatabase();
    const tracks = db.collection('learningTracks');
    const track = await tracks.findOne({ _id: id, ownerId: session.user.id });
    if (!track) return json({ error: 'Learning track not found.' }, 404);
    const snapshot = await cachedPublicPlaylist(db, track.playlistId, session.user.id, { refresh: true });
    return await withActiveOwnerMutation(db, session.user.id, async mongoSession => {
      const current = await tracks.findOne({ _id: id, ownerId: session.user.id, playlistId: track.playlistId }, { session: mongoSession });
      if (!current) return json({ error: 'Track changed. Refresh and retry.' }, 409);
      const count = snapshot.stale ? current.totalVideos : snapshot.totalVideos;
      let updatedAt = current.updatedAt;
      if (count !== current.totalVideos) {
        updatedAt = new Date(Math.max(Date.now(), new Date(current.updatedAt).getTime() + 1));
        const result = await tracks.updateOne({ _id: id, ownerId: session.user.id, updatedAt: current.updatedAt }, { $set: { totalVideos: count, updatedAt } }, { session: mongoSession });
        if (result.matchedCount !== 1) return json({ error: 'Track changed. Refresh and retry.' }, 409);
      }
      return json({ ...snapshot, playlistId: track.playlistId, savedTotalVideos: count ?? null, updatedAt });
    }, { sessionVersion: session.user.sessionVersion });
  } catch (error) {
    if (error instanceof PlaylistDiscoveryError) return json({ error: error.message }, error.status);
    console.error('Learning Tracks refresh failed:', error?.name);
    return json({ error: 'Playlist refresh is unavailable.' }, 503);
  }
}
