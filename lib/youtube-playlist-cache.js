import { discoverPublicPlaylist, PlaylistDiscoveryError } from './youtube-playlist-discovery.js';
import { randomUUID } from 'node:crypto';
import { checkRateLimit } from './rate-limit.js';

// Cache only per-playlist metadata, never media or owner progress.
export const PLAYLIST_FRESH_MS = 60 * 60 * 1000;
export const PLAYLIST_RETENTION_MS = 24 * 60 * 60 * 1000;
const pending = new Map();
const LEASE_MS = 120_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function cachedPublicPlaylist(db, playlistId, ownerId, { refresh = false, discover = discoverPublicPlaylist, now = Date.now, apiKey = process.env.OGE_YOUTUBE_DATA_API_KEY, throttle = checkRateLimit, wait = sleep } = {}) {
  if (!/^[A-Za-z0-9_-]{10,120}$/.test(playlistId)) throw new PlaylistDiscoveryError('Invalid playlist.', 400);
  const collection = db.collection('youtubePlaylistCache');
  const cached = await collection.findOne({ _id: playlistId, expiresAt: { $gt: new Date(now()) } });
  const eligible = () => cached && new Date(cached.expiresAt).getTime() > now();
  const snapshot = (entry, stale = false) => ({ videos: entry.videos, totalVideos: entry.totalVideos,
    fetchedAt: new Date(entry.fetchedAt).toISOString(), cached: true, stale });
  if (!refresh && eligible() && now() - new Date(cached.fetchedAt).getTime() < PLAYLIST_FRESH_MS)
    return snapshot(cached);
  const key = db.databaseName + ':' + playlistId;
  if (pending.has(key)) return pending.get(key);
  const task = (async () => {
    const leases = db.collection('youtubePlaylistLeases');
    const leaseId = randomUUID();
    const deadline = new Date(now() + LEASE_MS);
    let acquired = false;
    try {
      await leases.updateOne({ _id: playlistId, expiresAt: { $lte: new Date(now()) } },
        { $set: { leaseId, expiresAt: deadline } }, { upsert: true });
      acquired = true;
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    if (!acquired) {
      // Another instance is fetching. Poll briefly for its result; never start a duplicate fetch.
      for (let i = 0; i < 10; i++) {
        await wait(250);
        const fresh = await collection.findOne({ _id: playlistId, expiresAt: { $gt: new Date(now()) } });
        if (fresh && (!cached || new Date(fresh.fetchedAt) > new Date(cached.fetchedAt))) return snapshot(fresh);
      }
      // Do not return old metadata while another instance may be invalidating it.
      throw new PlaylistDiscoveryError('Playlist refresh already in progress. Retry shortly.', 409);
    }
    try {
    const latest = await collection.findOne({ _id: playlistId, expiresAt: { $gt: new Date(now()) } });
    if (latest && (!cached || new Date(latest.fetchedAt) > new Date(cached.fetchedAt))) return snapshot(latest);
    const limit = await throttle(db, { scope: 'learning-track-discover', identifier: ownerId, limit: 5, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) {
      if (eligible()) return snapshot(cached, true);
      throw new PlaylistDiscoveryError('Playlist refresh limit reached. Try again later.', 429);
    }
    let result;
    try { result = await discover(playlistId, apiKey); }
    catch (error) {
      // Do not serve stale metadata for missing, private or inconsistent playlists.
      if (error instanceof PlaylistDiscoveryError && [403, 404, 409, 422].includes(error.status)) {
        await collection.deleteOne({ _id: playlistId, ...(cached ? { fetchedAt: cached.fetchedAt } : {}) });
        throw error;
      }
      if (eligible() && error instanceof PlaylistDiscoveryError && (error.status === 502 || error.reason === 'quota'))
        return snapshot(cached, true);
      throw error;
    }
    const fetchedAt = new Date(now());
    const entry = { ...result, fetchedAt, expiresAt: new Date(fetchedAt.getTime() + PLAYLIST_RETENTION_MS) };
    if (now() >= deadline.getTime() || !await leases.findOne({ _id: playlistId, leaseId }))
      throw new PlaylistDiscoveryError('Playlist refresh expired. Retry shortly.', 409);
    await collection.updateOne({ _id: playlistId }, { $set: entry }, { upsert: true });
    return { ...result, fetchedAt: fetchedAt.toISOString(), cached: false, stale: false };
    } finally { await leases.deleteOne({ _id: playlistId, leaseId }); }
  })();
  pending.set(key, task);
  try { return await task; } finally { if (pending.get(key) === task) pending.delete(key); }
}
