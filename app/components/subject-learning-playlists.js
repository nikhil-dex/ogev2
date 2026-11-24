'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SubjectLearningPlaylists({ subjectSlug }) {
  const [tracks, setTracks] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/learning-tracks', { cache: 'no-store', signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setTracks(Array.isArray(data?.tracks) ? data.tracks : []); })
      .catch(() => { if (!controller.signal.aborted) setTracks([]); });
    return () => controller.abort();
  }, [subjectSlug]);
  const assigned = tracks.filter(track => track.subjectSlug === subjectSlug);
  if (!assigned.length) return null;
  return <section className="notes-section" aria-label="Learning playlists in this subject">
    <div className="section-heading">
      <div><p className="eyebrow">LEARNING TRACKS</p><h2>Playlists <span className="count-pill">{assigned.length}</span></h2></div>
      <Link className="filter-chip" href={'/learning-tracks?subject=' + encodeURIComponent(subjectSlug)}>Manage playlists</Link>
    </div>
    <div className="note-filters">
      {assigned.map(track => <Link className="filter-chip" key={track.id} href={'/learning-tracks?subject=' + encodeURIComponent(subjectSlug) + '&track=' + encodeURIComponent(track.id)}>
        {track.title} · {track.completedVideos}{track.totalVideos == null ? '' : '/' + track.totalVideos} completed
      </Link>)}
    </div>
  </section>;
}
