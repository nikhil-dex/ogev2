'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SubjectLearningPlaylists({ subjectSlug, vaultMode, selectedTrack, onSelect }) {
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
      <button type="button" className={!selectedTrack ? 'filter-chip active' : 'filter-chip'} aria-pressed={!selectedTrack} onClick={() => onSelect(null)}>All Notes</button>
      {assigned.map(track => <button type="button" className={selectedTrack?.id === track.id ? 'filter-chip active' : 'filter-chip'} aria-pressed={selectedTrack?.id === track.id} key={track.id} onClick={() => onSelect({ id: track.id, title: track.title, subjectSlug, noteIds: (track.capturedNotes || []).filter(item => item.subjectSlug === subjectSlug && item.storage === (vaultMode ? 'vault' : 'notes')).map(item => item.noteId) })}>
        {track.title} · {track.completedVideos}{track.totalVideos == null ? '' : '/' + track.totalVideos} completed
      </button>)}
    </div>
  </section>;
}
