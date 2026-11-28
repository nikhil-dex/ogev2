'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteNavbar from '../components/site-navbar';
import TrackTopics from './track-topics.js';
import { flexibleStudyPlan } from '../../lib/learning-track-flexible-plan.js';
import { buildDailyLessons, currentLearningDay } from '../../lib/learning-tracks.js';
import { buildIdentityLessonDays, currentIdentityLearningDay } from '../../lib/learning-track-video-progress.js';
import styles from './learning-tracks.module.css';

async function read(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not complete request.');
  return data;
}
export default function LearningTracksPage() {
  const [tracks, setTracks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('all');
  useEffect(() => {
    const subject = new URLSearchParams(window.location.search).get('subject');
    let active = true;
    Promise.resolve().then(() => { if (active && subject && /^[a-f0-9-]{36}$/i.test(subject)) setSubjectFilter(subject); });
    return () => { active = false; };
  }, []);
  const [form, setForm] = useState({ title: '', url: '', videosPerDay: '2', totalVideos: '', subjectSlug: '' });
  useEffect(() => {
    const track = new URLSearchParams(window.location.search).get('track');
    if (track && /^[a-f0-9-]{36}$/i.test(track)) document.getElementById('track-' + track)?.scrollIntoView({ block: 'start' });
  }, [tracks, subjectFilter]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [discovered, setDiscovered] = useState({});
  const [planDrafts, setPlanDrafts] = useState({});
  const [noteLinkingEnabled, setNoteLinkingEnabled] = useState(false);
  const [lessonLinks, setLessonLinks] = useState({});
  const [linkChecks, setLinkChecks] = useState({});
  const [chooser, setChooser] = useState(null);
  const [noteOptions, setNoteOptions] = useState([]);
  const [noteCursor, setNoteCursor] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await read(await fetch('/api/learning-tracks', { cache: 'no-store' }));
      setTracks(data.tracks);
      setNoteLinkingEnabled(data.noteLinkingEnabled === true);
      try { const list = await read(await fetch('/api/subjects', { cache: 'no-store' })); setSubjects(Array.isArray(list) ? list : []); setSubjectsLoaded(true); } catch { setSubjectsLoaded(false); }
    }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);
  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { track } = await read(await fetch('/api/learning-tracks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, videosPerDay: Number(form.videosPerDay),
          totalVideos: form.totalVideos.trim() ? Number(form.totalVideos) : null,
        }),
      }));
      setTracks((current) => [track, ...current]);
      setForm({ title: '', url: '', videosPerDay: '2', totalVideos: '', subjectSlug: '' });
      setMessage('Playlist added. Progress remains manual until you mark videos complete.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function progress(track, delta, videoId = null) {
    if (busy) return;
    if (track.progressMode === 'videoIds' && !videoId) {
      setError('Discover this playlist before updating individual lessons.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      const { track: updated } = await read(await fetch('/api/learning-tracks', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(track.progressMode === 'videoIds'
          ? { id: track.id, action: delta > 0 ? 'complete-video' : 'undo-video',
            videoId, expectedUpdatedAt: track.updatedAt }
          : { id: track.id, expectedCompleted: track.completedVideos,
            completedVideos: track.completedVideos + delta }),
      }));
      setTracks((current) => current.map((item) => item.id === track.id ? updated : item));
    } catch (err) { setError(err.message); await load(); }
    finally { setBusy(false); }
  }
  async function adoptVideoProgress(track, snapshot) {
    if (busy || track.progressMode === 'videoIds') return;
    if (track.completedVideos > snapshot.videos.length) {
      setError('Recorded progress exceeds this playlist. Reconcile the count before switching.'); return;
    }
    const completed = snapshot.videos.slice(0, track.completedVideos).map((video) => video.videoId);
    if (new Set(completed).size !== completed.length) {
      setError('The completed playlist prefix contains repeated video IDs. Keep your count until the duplicate entries are reviewed.'); return;
    }
    const prompt = track.completedVideos === 0
      ? 'Use video-specific completion for this playlist?'
      : 'Confirm that the FIRST ' + track.completedVideos + ' videos in the CURRENT playlist order were already completed. If the creator reordered the playlist, cancel; your old count will remain unchanged.';
    if (!window.confirm(prompt)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { track: updated } = await read(await fetch('/api/learning-tracks', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: track.id, action: 'adopt-video-ids',
          expectedUpdatedAt: track.updatedAt, expectedCompleted: track.completedVideos,
          videoIds: completed }),
      }));
      setTracks((current) => current.map((item) => item.id === track.id ? updated : item));
      setMessage('Progress now follows video IDs for ' + track.title + '.');
    } catch (err) { setError(err.message); await load(); }
    finally { setBusy(false); }
  }
  async function saveTopics(track, action) {
    if (busy) return false;
    setBusy(true); setError(''); setMessage('');
    try {
      const { track: updated } = await read(await fetch('/api/learning-tracks', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: track.id, expectedUpdatedAt: track.updatedAt, ...action }),
      }));
      setTracks(current => current.map(item => item.id === track.id ? updated : item));
      setMessage('Topics saved.');
      return true;
    } catch (err) { setError(err.message); return false; }
    finally { setBusy(false); }
  }
  async function assignSubject(track, subjectSlug) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { track: updated } = await read(await fetch('/api/learning-tracks', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: track.id, action: 'set-subject', subjectSlug, expectedUpdatedAt: track.updatedAt }),
      }));
      setTracks(current => current.map(item => item.id === track.id ? updated : item));
      setMessage('Track subject saved.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function savePlan(track) {
    if (busy) return;
    const draft = planDrafts[track.id] || {};
    const videosPerDay = Number(draft.videosPerDay ?? track.videosPerDay);
    const startDate = draft.startDate ?? track.startDate ?? '';
    setBusy(true); setError(''); setMessage('');
    try {
      const { track: updated } = await read(await fetch('/api/learning-tracks', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: track.id, expectedUpdatedAt: track.updatedAt,
          videosPerDay, startDate }),
      }));
      setTracks((current) => current.map((item) => item.id === track.id ? updated : item));
      setPlanDrafts((current) => {
        const next = { ...current }; delete next[track.id]; return next;
      });
      setMessage('Daily goal and start date saved for ' + track.title + '.');
    } catch (err) { setError(err.message); await load(); }
    finally { setBusy(false); }
  }
  function editPlan(trackId, key, value) {
    setPlanDrafts((current) => ({
      ...current, [trackId]: { ...(current[trackId] || {}), [key]: value },
    }));
  }
  async function discover(track) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await read(await fetch('/api/learning-tracks/discover?id=' + encodeURIComponent(track.id), { method: discovered[track.id] ? 'POST' : 'GET', cache: 'no-store' }));
      if (Object.hasOwn(data, 'savedTotalVideos')) setTracks(current => current.map(item => item.id === track.id ? { ...item, totalVideos: data.savedTotalVideos, updatedAt: data.updatedAt } : item));
      setDiscovered((current) => ({ ...current, [track.id]: data }));
      setLinkChecks((current) => Object.fromEntries(Object.entries(current)
        .filter(([key]) => !key.startsWith(track.id + ':'))));
      if (noteLinkingEnabled) {
        const linked = await read(await fetch('/api/learning-tracks/note-links?trackId=' + encodeURIComponent(track.id), { cache: 'no-store' }));
        setLessonLinks((current) => ({ ...current, [track.id]: linked.links }));
      }
      setMessage(data.stale ? 'Using previously retrieved playlist metadata from ' + new Date(data.fetchedAt).toLocaleString() + '. Refresh is temporarily unavailable.' : 'Playlist lessons loaded.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function remove(track) {
    if (!window.confirm('Remove “' + track.title + '” and its progress record?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await read(await fetch('/api/learning-tracks?id=' + encodeURIComponent(track.id), { method: 'DELETE' }));
      setTracks((current) => current.filter((item) => item.id !== track.id));
      setDiscovered((current) => {
        const next = { ...current }; delete next[track.id]; return next;
      });
      setPlanDrafts((current) => {
        const next = { ...current }; delete next[track.id]; return next;
      });
      setLessonLinks((current) => {
        const next = { ...current }; delete next[track.id]; return next;
      });
      setChooser(null);
      setLinkChecks((current) => Object.fromEntries(Object.entries(current)
        .filter(([key]) => !key.startsWith(track.id + ':'))));
      setMessage('Learning track removed.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function loadNotes(cursor = null, append = false) {
    setBusy(true); setError('');
    try {
      const data = await read(await fetch('/api/learning-tracks/note-links?mode=notes' +
        (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''), { cache: 'no-store' }));
      setNoteOptions((current) => append ? [...current, ...data.notes] : data.notes);
      setNoteCursor(data.nextCursor);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  function chooseNote(track, video) {
    setChooser({ trackId: track.id, videoId: video.videoId });
    setNoteOptions([]); setNoteCursor(null);
    void loadNotes();
  }
  async function linkNote(noteId) {
    if (!chooser || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const { link } = await read(await fetch('/api/learning-tracks/note-links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...chooser, noteId }),
      }));
      setLessonLinks((current) => ({
        ...current, [chooser.trackId]: [...(current[chooser.trackId] || []), link],
      }));
      setChooser(null);
      setLinkChecks((current) => ({ ...current, [link.trackId + ':' + link.videoId]: undefined }));
      setMessage('The lesson now points to your existing private GitHub Note; no Note content was copied.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function unlinkNote(link) {
    if (!window.confirm('Remove this lesson link? The private GitHub Note will stay unchanged.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await read(await fetch('/api/learning-tracks/note-links?' +
        new URLSearchParams({ trackId: link.trackId, videoId: link.videoId, noteId: link.noteId }), { method: 'DELETE' }));
      setLessonLinks((current) => ({
        ...current, [link.trackId]: (current[link.trackId] || []).filter((item) =>
          item.videoId !== link.videoId),
      }));
      setLinkChecks((current) => ({ ...current, [link.trackId + ':' + link.videoId]: undefined }));
      setMessage('Lesson link removed. GitHub Note was not deleted.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function refreshLinks(track) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await read(await fetch('/api/learning-tracks/note-links?trackId=' +
        encodeURIComponent(track.id), { cache: 'no-store' }));
      setLessonLinks((current) => ({ ...current, [track.id]: data.links }));
      setLinkChecks((current) => Object.fromEntries(Object.entries(current)
        .filter(([key]) => !key.startsWith(track.id + ':'))));
      setMessage('Links refreshed. Existing associations are not proof that GitHub Notes still exist.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function verifyNote(link) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    const key = link.trackId + ':' + link.videoId;
    setLinkChecks((current) => ({ ...current, [key]: undefined }));
    try {
      const data = await read(await fetch('/api/learning-tracks/note-links?' +
        new URLSearchParams({ mode: 'verify', trackId: link.trackId, videoId: link.videoId }),
      { cache: 'no-store', headers: { 'X-Oge-Verify-Intent': 'manual' } }));
      setLinkChecks((current) => ({ ...current, [key]: data.status }));
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }
  async function copyStarter(video) {
    try {
      await navigator.clipboard.writeText(video.title + '\n' + video.url + '\n\n');
      setMessage('Lesson starter copied. Open Vault Quick Capture and paste it into a new draft.');
      setError('');
    } catch { setError('Clipboard unavailable. Copy the video title and link manually.'); }
  }
  return <main className="shell oge-shell"><SiteNavbar />
    <section className={styles.hero}>
      <span className="oge-section-kicker">LEARNING TRACKS</span>
      <h1>Make playlists into <span>progress.</span></h1>
      <p>Organize any supported YouTube playlist, set a daily goal and track your progress. Discover lessons, group related topics and connect them to your Notes. Use the Oge extension to save lesson notes with video references as you study.</p>
    </section>
    <section className={styles.grid}>
      <form className={styles.panel} onSubmit={create}>
        <h2>New track</h2>
        <label>Track name<input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Enter a course or playlist name" /></label>
        <label>YouTube playlist URL<input required type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.youtube.com/playlist?list=…" /></label>
        <label>Videos per day<input required type="number" min="1" max="20" value={form.videosPerDay} onChange={(e) => setForm({ ...form, videosPerDay: e.target.value })} /></label>
        <label>Total videos (optional)<input type="number" min="1" max="10000" value={form.totalVideos} onChange={(e) => setForm({ ...form, totalVideos: e.target.value })} placeholder="Unknown" /></label>
        <label>Notes subject (optional)<select disabled={!subjectsLoaded || busy} value={form.subjectSlug} onChange={e => setForm({ ...form, subjectSlug: e.target.value })}><option value="">Unassigned</option>{subjects.map(subject => <option key={subject.slug} value={subject.slug}>{subject.name}</option>)}</select></label>
        <button type="submit" disabled={busy}>Add learning track</button>
      </form>
      <section className={styles.panel} aria-label="Your learning tracks">
        <div className={styles.head}><h2>Your tracks</h2><button type="button" onClick={load} disabled={loading || busy}>Refresh</button></div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {message && <p role="status">{message}</p>}
        {loading && <p>Loading tracks…</p>}
        {!loading && tracks.length === 0 && <p>No tracks yet. Add your first playlist.</p>}
        <label>Filter by subject <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}><option value="all">All subjects</option><option value="">Unassigned</option>{subjects.map(subject => <option key={subject.slug} value={subject.slug}>{subject.name}</option>)}</select></label>
        {tracks.filter(track => subjectFilter === 'all' || subjectFilter === (subjects.some(subject => subject.slug === track.subjectSlug) ? track.subjectSlug : '')).map((track) => {
          const snapshot = discovered[track.id];
          const identityMode = track.progressMode === 'videoIds';
          const validProgress = snapshot && (identityMode || track.completedVideos <= snapshot.totalVideos);
          const days = validProgress ? identityMode
            ? buildIdentityLessonDays(snapshot.videos, track.videosPerDay, track.completedVideoIds, track.startDate || '', buildDailyLessons)
            : buildDailyLessons(snapshot.videos, track.videosPerDay, track.completedVideos, track.startDate || '') : [];
          const focus = validProgress ? identityMode
            ? currentIdentityLearningDay(days)
            : currentLearningDay(days, track.completedVideos, track.videosPerDay) : null;
          const currentDay = identityMode
            ? (focus ? days.findIndex((day) => day.day === focus.day) : days.length)
            : Math.floor(track.completedVideos / track.videosPerDay);
          const upcoming = days.slice(currentDay, currentDay + 7);
          const flexible = snapshot && identityMode ? flexibleStudyPlan(snapshot.videos, track.completedVideoIds, track.completionTimeline, track.videosPerDay, track.startDate) : null;
          const unavailableVideos = snapshot && noteLinkingEnabled
            ? (lessonLinks[track.id] || []).filter((link) =>
              !snapshot.videos.some((video) => video.videoId === link.videoId)).length : 0;
          return <article key={track.id} id={'track-' + track.id} className={styles.track}>
            <h3>{track.title}</h3>
            <label>Notes subject <select disabled={busy || !subjectsLoaded} value={subjects.some(subject => subject.slug === track.subjectSlug) ? track.subjectSlug : ''} onChange={e => void assignSubject(track, e.target.value)}><option value="">Unassigned</option>{subjects.map(subject => <option key={subject.slug} value={subject.slug}>{subject.name}</option>)}</select></label>
            {subjectsLoaded && track.subjectSlug && !subjects.some(subject => subject.slug === track.subjectSlug) && <p>Previous subject unavailable. Choose a new subject.</p>}
            <p>{track.videosPerDay} video{track.videosPerDay === 1 ? '' : 's'} per day · {track.completedVideos}{track.totalVideos == null ? ' completed (total unknown)' : ' / ' + track.totalVideos + ' completed'}</p>
            {track.totalVideos !== null && <progress max={track.totalVideos} value={track.completedVideos} aria-label={'Progress for ' + track.title} />}
            <div className={styles.plan} aria-label={'Study plan for ' + track.title}>
              <label>Daily goal
                <input type="number" min="1" max="20" value={planDrafts[track.id]?.videosPerDay ?? String(track.videosPerDay)}
                  onChange={(event) => editPlan(track.id, 'videosPerDay', event.target.value)} />
              </label>
              <label>Start date (optional)
                <input type="date" value={planDrafts[track.id]?.startDate ?? track.startDate ?? ''}
                  onChange={(event) => editPlan(track.id, 'startDate', event.target.value)} />
              </label>
              <button type="button" disabled={busy || !planDrafts[track.id] ||
                (Number(planDrafts[track.id]?.videosPerDay ?? track.videosPerDay) === track.videosPerDay &&
                (planDrafts[track.id]?.startDate ?? track.startDate ?? '') === (track.startDate ?? ''))}
                onClick={() => savePlan(track)}>Save plan</button>
            </div>
            <div className={styles.actions}>
              <a href={track.url} target="_blank" rel="noopener noreferrer">Open playlist ↗</a>
              <button type="button" disabled={busy} onClick={() => discover(track)}>{snapshot ? 'Refresh lessons' : 'Discover lessons'}</button>
              <button type="button" disabled={busy || track.completedVideos <= 0 ||
                (identityMode && !track.completedVideoIds?.length)}
                onClick={() => progress(track, -1, identityMode
                  ? track.completedVideoIds[track.completedVideoIds.length - 1] : null)}>Undo one</button>
              {!identityMode && <button type="button" disabled={busy || (track.totalVideos !== null && track.completedVideos >= track.totalVideos) || (snapshot && track.completedVideos >= snapshot.totalVideos)} onClick={() => progress(track, 1)}>Completed one +</button>}
              {noteLinkingEnabled && snapshot && <button type="button" disabled={busy} onClick={() => refreshLinks(track)}>Refresh Note links</button>}
              <button type="button" disabled={busy} onClick={() => remove(track)}>Remove</button>
            </div>
            {snapshot && <section className={styles.lessons} aria-label={'Lessons for ' + track.title}>
              <p>Snapshot: {snapshot.totalVideos} public playlist entries. Titles and order can change. {identityMode
                ? 'Completed videos are matched by video ID, even if positions change.'
                : 'Legacy progress follows playlist order, not video identity.'}</p>
              {flexible && <section className={styles.focus} aria-label="Flexible daily plan">
                <span className={styles.focusEyebrow}>FLEXIBLE STUDY PLAN</span>
                <p>{flexible.completedToday} / {track.videosPerDay} explicitly marked complete today (device local date).</p>
                {flexible.undatedCompleted > 0 && <p>{flexible.undatedCompleted} older completions have no recorded date.</p>}
                {flexible.goalMet && <p>Today&apos;s goal is met. You can continue or resume tomorrow.</p>}
                <p>{flexible.remaining} unique lessons remaining. Unfinished lessons carry forward automatically.</p>
                <ol className={styles.dayList}>{flexible.blocks.slice(0, 7).map(block => <li key={block.date}><strong>{block.date}</strong><ul>{block.videos.map(video => <li key={video.videoId}><a href={video.url} target="_blank" rel="noopener noreferrer">{video.title}</a></li>)}</ul></li>)}</ol>
              </section>}
              <TrackTopics track={track} videos={snapshot.videos} busy={busy} onSave={saveTopics} />
              {!identityMode && <div className={styles.identityUpgrade}>
                <p>Switch to video-specific progress to keep completed lessons marked when a playlist is reordered. Existing progress is not converted automatically.</p>
                <button type="button" disabled={busy || track.completedVideos > snapshot.videos.length}
                  onClick={() => adoptVideoProgress(track, snapshot)}>Use video-specific progress</button>
              </div>}
              {identityMode && (track.completedVideoIds || []).some((id) =>
                !snapshot.videos.some((video) => video.videoId === id)) &&
                <p className={styles.error}>Some completed videos are no longer in this playlist snapshot. Their completion records remain saved; review before changing the playlist.</p>}
              {unavailableVideos > 0 && <p className={styles.error}>{unavailableVideos} saved Note link(s) are absent from this playlist snapshot. Check manually; no links or Notes were changed.</p>}
              {track.totalVideos !== null && track.totalVideos !== snapshot.totalVideos &&
                <p className={styles.error}>Your manually recorded total ({track.totalVideos}) differs from the discovered count ({snapshot.totalVideos}). Refresh lessons to reconcile your saved total without removing progress.</p>}
              {!validProgress ? <p className={styles.error}>Recorded progress exceeds discovered videos. Schedule hidden until the data is reconciled.</p> :
                <>
                  {focus && <section className={styles.focus} aria-label={'Next lessons for ' + track.title}>
                    <div className={styles.focusHeading}>
                      <div><span className={styles.focusEyebrow}>CONTINUE LEARNING</span>
                        <h4>Study block {focus.day}</h4>
                        <p>{focus.completedInDay} of {focus.plannedInDay} completed in this study block</p>
                      </div>
                      <span className={styles.focusCount}>{focus.remaining.length} left</span>
                    </div>
                    <ol className={styles.focusList}>
                      {focus.remaining.map((video, index) => <li key={video.position}>
                        <span className={styles.focusNumber}>{index + 1}</span>
                        <a href={video.url} target="_blank" rel="noopener noreferrer">{video.title}</a>
                        {index === 0 && <span className={styles.nextBadge}>Next up</span>}
                      </li>)}
                    </ol>
                    <div className={styles.actions}>
                      <a className={styles.watchNext} href={focus.next.url} target="_blank" rel="noopener noreferrer">Watch next lesson ↗</a>
                      <button type="button" disabled={busy} onClick={() => progress(track, 1, identityMode ? focus.next.videoId : null)}>Mark next complete ✓</button>
                    </div>
                    <p className={styles.focusHint}>Mark complete after watching. {identityMode
                      ? 'Completion follows video IDs, not playlist positions.'
                      : 'Legacy progress follows playlist order; switch to video-specific progress after reviewing the current playlist.'}</p>
                  </section>}
                  <p>Original calendar plan: {track.videosPerDay} per day{track.startDate ? ' · starting ' + track.startDate : ' · dates not set'}. Edit the plan above to change this track only.</p>
                  <p>{days.length} lesson days total · showing {upcoming.length} upcoming day{upcoming.length === 1 ? '' : 's'}</p>
                  {upcoming.length === 0 && <p>All discovered videos marked complete.</p>}
                  <ol className={styles.dayList}>
                    {upcoming.map((day) => <li key={day.day}>
                      <strong>Day {day.day}{day.date ? ' · ' + day.date : ''}</strong>
                      <ul>{day.videos.map((video) => <li key={video.position}>
                        {video.completed ? '✓ ' : ''}<a href={video.url} target="_blank" rel="noopener noreferrer">{video.title}</a>
                        {identityMode && <button type="button" disabled={busy}
                          onClick={() => progress(track, video.completed ? -1 : 1, video.videoId)}>
                          {video.completed ? 'Mark not complete' : 'Mark complete'}
                        </button>}
                        {noteLinkingEnabled && <>
                          {(lessonLinks[track.id] || []).some((link) => link.videoId === video.videoId) ?
                            <span className={styles.noteActions}>
                              <span>Linked to private Note (not automatically reverified)</span>
                              <button type="button" disabled={busy} onClick={() => verifyNote(
                                lessonLinks[track.id].find((link) => link.videoId === video.videoId))}>Verify linked Note</button>
                              {linkChecks[track.id + ':' + video.videoId] === 'present' &&
                                <span role="status">Present in your Vault at check time</span>}
                              {linkChecks[track.id + ':' + video.videoId] === 'missing' &&
                                <span role="status">No longer found in your current Vault; link remains unchanged</span>}
                              <button type="button" disabled={busy} onClick={() => unlinkNote(
                                lessonLinks[track.id].find((link) => link.videoId === video.videoId))}>Unlink</button>
                            </span> :
                            <button type="button" disabled={busy} onClick={() => chooseNote(track, video)}>Link existing Note</button>}
                          <button type="button" disabled={busy} onClick={() => copyStarter(video)}>Copy for Quick Capture</button>
                          <a href="/vault/capture" target="_blank" rel="noopener noreferrer">Open Vault Capture</a>
                        </>}
                      </li>)}</ul>
                    </li>)}
                  </ol>
                  {chooser?.trackId === track.id && <section className={styles.notePicker} aria-label="Choose a committed private GitHub Note">
                    <strong>Choose a private GitHub Note for this video</strong>
                    <p>Read-only owner-verified picker (8 per page). Titles stay in browser memory; only Note ID is linked. Do not link Notes from a different Vault.</p>
                    {noteOptions.length === 0 && <p>No committed Notes found on this page.</p>}
                    {noteOptions.map((note) => <div className={styles.noteChoice} key={note.id}>
                      <span>{note.heading}</span>
                      <button type="button" disabled={busy} onClick={() => linkNote(note.id)}>Link this Note</button>
                    </div>)}
                    <div className={styles.actions}>
                      {noteCursor && <button type="button" disabled={busy} onClick={() => loadNotes(noteCursor, true)}>More Notes</button>}
                      <button type="button" disabled={busy} onClick={() => setChooser(null)}>Cancel</button>
                    </div>
                  </section>}
                </>}
            </section>}
          </article>;
        })}
      </section>
    </section>
  </main>;
}
