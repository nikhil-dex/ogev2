'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { appendStudyDueNotes, removeReviewedStudyNote, skipStudyNote } from '../../../lib/oge-vault-study-queue.js';
import { readDailyStudy, saveDailyStudy, finishDailyStudyReview } from '../../../lib/oge-vault-study-goal.js';

async function json(response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || 'Could not load study notes.');
  return value;
}

export default function VaultStudyClient({ ownerId, repoId }) {
  const [notes, setNotes] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [completed, setCompleted] = useState(0);
  const [scanned, setScanned] = useState(0);
  const [total, setTotal] = useState(null);
  const [learnedCount, setLearnedCount] = useState(0);
  const [daily, setDaily] = useState({ goal: 10, completed: 0, date: '' });
  const goalKey = 'oge:vault:study-goal:' + ownerId + ':' + repoId;
  const load = useCallback(async (next = null) => {
    setLoading(true); setError('');
    try {
      const page = await json(await fetch('/api/vault/study' +
        (next ? '?cursor=' + encodeURIComponent(next) : ''), { cache: 'no-store' }));
      if (!Array.isArray(page.notes)) throw new Error('Invalid Vault study page.');
      setNotes((existing) => next ? appendStudyDueNotes(existing, page.notes) :
        appendStudyDueNotes([], page.notes));
      setCursor(page.nextCursor || null);
      setTotal(page.total);
      setLearnedCount(page.learnedCount || 0);
      setScanned((count) => next ? count + page.notes.length : page.notes.length);
      if (!next) setRevealed(false);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) setDaily(readDailyStudy(window.localStorage, goalKey));
    });
    return () => { active = false; };
  }, [goalKey]);
  const note = notes[0] || null;

  async function rate(rating) {
    if (!note || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await json(await fetch('/api/vault/study', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id, rating }),
      }));
      setNotes((items) => removeReviewedStudyNote(items, note.id));
      setCompleted((n) => n + 1);
      setDaily(finishDailyStudyReview(window.localStorage, goalKey));
      if (result.learned !== note.learned)
        setLearnedCount((n) => Math.max(0, n + (result.learned ? 1 : -1)));
      setRevealed(false);
      setMessage('Review saved. Next due ' + new Date(result.reviewDueAt).toLocaleDateString('en-IN') + '.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <section className="oge-module-section" aria-labelledby="study-title">
      <div className="oge-section-heading"><div>
        <span className="oge-section-kicker">GITHUB VAULT · ACTIVE RECALL</span>
        <h1 id="study-title">Revision &amp; Study<span>.</span></h1>
        <p>Review committed Notes. Only progress and due dates are indexed in MongoDB.</p>
      </div><Link className="oge-primary-link" href="/vault/notes">Open Notes →</Link></div>
      <div className="oge-workflow-summary">
        <div className="oge-workflow-stat"><span className="oge-section-kicker">DUE IN THIS PAGE</span><strong>{notes.length}</strong></div>
        <div className="oge-workflow-stat"><span className="oge-section-kicker">REVIEWED THIS VISIT</span><strong>{completed}</strong></div>
        <div className="oge-workflow-stat"><span className="oge-section-kicker">NOTES SCANNED</span><strong>{scanned}{total !== null ? ' / ' + total : ''}</strong></div>
        <div className="oge-workflow-stat"><span className="oge-section-kicker">LEARNED NOTES</span><strong>{learnedCount}</strong></div>
      </div>
      <div className="hub-card oge-module-card">
        <label htmlFor="vault-daily-goal">Today&apos;s revision goal</label>
        <select id="vault-daily-goal" value={daily.goal} onChange={(event) => {
          const next = saveDailyStudy(window.localStorage, goalKey, {
            ...readDailyStudy(window.localStorage, goalKey),
            goal: Number(event.target.value),
          });
          setDaily(next);
        }}>
          {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} Notes</option>)}
        </select>
        <p role="status">{daily.completed} / {daily.goal} reviews completed today</p>
        <progress value={Math.min(daily.completed, daily.goal)} max={daily.goal} />
      </div>
      {error && <p role="alert" className="oge-form-error">{error}</p>}
      {message && <p role="status" className="oge-form-success">{message}</p>}
      {loading ? <p>Loading your Vault revision queue…</p> : note ? (
        <div className="hub-card oge-module-card">
          <span className="hub-card-kicker">SUBJECT · {note.subjectId}</span>
          <h2>{note.heading}</h2>
          {note.learned && <p className="oge-settings-note">Learned previously · due for a refresher</p>}
          {notes.length > 1 && <button type="button" className="oge-settings-secondary-button"
            disabled={saving} onClick={() => {
              setNotes((items) => skipStudyNote(items));
              setRevealed(false);
              setMessage('Card moved to the end of the current study queue.');
            }}>Skip for now →</button>}
          {revealed ? <div className="oge-notes-preview">{note.answer}</div> :
            <button type="button" className="oge-primary-link" onClick={() => setRevealed(true)}>Reveal answer</button>}
          {revealed && <div className="oge-settings-data-actions">
            {['again', 'hard', 'good', 'easy'].map((rating) =>
              <button key={rating} type="button" className="oge-settings-secondary-button"
                disabled={saving} onClick={() => rate(rating)}>{rating[0].toUpperCase() + rating.slice(1)}</button>)}
          </div>}
          <p className="oge-settings-note">Again: 1 day · Hard: 3 days · Good: 7 days · Easy: 14 days</p>
        </div>
      ) : <div className="home-dashboard-empty"><strong>No due cards on this page.</strong>
        <p>Review more notes or return when your next revision is due.</p></div>}
      {!loading && cursor &&
        <button type="button" className="oge-settings-secondary-button" disabled={saving}
          onClick={() => load(cursor)}>Scan next 20 Notes →</button>}
      <p className="oge-settings-note">Newly scanned due cards are appended, not substituted for unreviewed cards. If a page contains no due cards, scan the next page to continue.</p>
    </section>
  );
}
