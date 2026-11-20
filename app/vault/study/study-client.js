'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { markdownHtml } from '../../../lib/markdown.js';
import { appendStudyDueNotes } from '../../../lib/oge-vault-study-queue.js';
import { studyDayKey } from '../../../lib/oge-vault-study-goal.js';

async function json(response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || 'Could not load study notes.');
  return value;
}
function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const ratings = [
  { id: 'again', label: 'Again', hint: '10 min' },
  { id: 'hard', label: 'Hard', hint: '1+ day' },
  { id: 'good', label: 'Good', hint: 'Longer interval' },
  { id: 'easy', label: 'Easy', hint: 'Longest interval' },
];

export default function VaultStudyClient() {
  const [allNotes, setAllNotes] = useState([]);
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
  const [goalSaving, setGoalSaving] = useState(false);
  const [mode, setMode] = useState('due');
  const [subject, setSubject] = useState('all');
  const [cardId, setCardId] = useState('');
  const [reviewedIds, setReviewedIds] = useState([]);
  const [order, setOrder] = useState([]);
  const reviewedSet = useMemo(() => new Set(reviewedIds), [reviewedIds]);

  const load = useCallback(async (next = null) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ day: studyDayKey() });
      if (next) params.set('cursor', next);
      const page = await json(await fetch('/api/vault/study?' + params.toString(),
        { cache: 'no-store' }));
      if (!Array.isArray(page.notes)) throw new Error('Invalid Vault study page.');
      setAllNotes((existing) => next ? [...existing, ...page.notes.filter((note) =>
        !existing.some((old) => old.id === note.id))] : [...page.notes]);
      setCursor(page.nextCursor || null);
      setTotal(page.total);
      setLearnedCount(page.learnedCount || 0);
      if (page.daily) setDaily(page.daily);
      setScanned((count) => next ? count + page.notes.length : page.notes.length);
      if (!next) { setRevealed(false); setCardId(''); setOrder([]); setReviewedIds([]); }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);

  const subjectOptions = useMemo(() => [...new Set(allNotes.map((note) => note.subjectId).filter(Boolean))].sort(), [allNotes]);
  const available = useMemo(() => allNotes.filter((note) => !reviewedSet.has(note.id) &&
    (mode === 'all' || note.due) && (subject === 'all' || note.subjectId === subject)),
  [allNotes, reviewedSet, mode, subject]);
  const ordered = useMemo(() => {
    const byId = new Map(available.map((note) => [note.id, note]));
    const existing = order.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(existing.map((note) => note.id));
    return [...existing, ...available.filter((note) => !seen.has(note.id))];
  }, [available, order]);
  const activeIndex = Math.max(0, ordered.findIndex((note) => note.id === cardId));
  const note = ordered[activeIndex] || null;
  const dueCount = appendStudyDueNotes([], allNotes).filter((item) =>
    !reviewedSet.has(item.id) && (subject === 'all' || item.subjectId === subject)).length;

  function navigate(delta) {
    if (!note || saving) return;
    const index = activeIndex + delta;
    if (index < 0 || index >= ordered.length) return;
    setCardId(ordered[index].id);
    setRevealed(false);
    setMessage('');
  }
  function skip() {
    if (ordered.length < 2 || saving) return;
    const activeId = note.id;
    setOrder([...ordered.filter((item) => item.id !== activeId).map((item) => item.id), activeId]);
    setCardId(ordered[activeIndex + 1]?.id || ordered[0].id);
    setRevealed(false);
  }
  function shuffleDeck() {
    if (saving || ordered.length < 2) return;
    const mixed = shuffle(ordered.map((item) => item.id));
    setOrder(mixed); setCardId(mixed[0]); setRevealed(false);
  }
  function changeMode(value) {
    setMode(value); setCardId(''); setRevealed(false); setOrder([]);
  }
  function changeSubject(value) {
    setSubject(value); setCardId(''); setRevealed(false); setOrder([]);
  }
  async function changeDailyGoal(goal) {
    setGoalSaving(true); setError('');
    try {
      const result = await json(await fetch('/api/vault/study', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: studyDayKey(), goal }),
      }));
      setDaily(result.daily);
      setMessage('Daily study goal saved across devices.');
    } catch (err) { setError(err.message); }
    finally { setGoalSaving(false); }
  }
  async function rate(rating) {
    if (!note || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await json(await fetch('/api/vault/study', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id, rating, day: studyDayKey() }),
      }));
      setReviewedIds((ids) => [...ids, note.id]);
      setCompleted((n) => n + 1);
      if (result.daily) setDaily(result.daily);
      if (result.learned !== note.learned)
        setLearnedCount((n) => Math.max(0, n + (result.learned ? 1 : -1)));
      setCardId(ordered[activeIndex + 1]?.id || ordered[activeIndex - 1]?.id || '');
      setRevealed(false);
      setMessage('Review saved. Next due ' + new Date(result.reviewDueAt).toLocaleString('en-IN') + '.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return <section className="oge-module-section oge-study" aria-labelledby="study-title">
    <div className="oge-section-heading"><div>
      <span className="oge-section-kicker">GITHUB VAULT · ACTIVE RECALL</span>
      <h1 id="study-title">Revision &amp; Study<span>.</span></h1>
      <p>Review committed Notes. Only progress and due dates are indexed in MongoDB.</p>
    </div><Link className="oge-primary-link" href="/vault/notes">Open Notes →</Link></div>
    <div className="oge-workflow-summary">
      <div className="oge-workflow-stat"><span className="oge-section-kicker">DUE IN LOADED NOTES</span><strong>{dueCount}</strong></div>
      <div className="oge-workflow-stat"><span className="oge-section-kicker">REVIEWED THIS VISIT</span><strong>{completed}</strong></div>
      <div className="oge-workflow-stat"><span className="oge-section-kicker">NOTES SCANNED</span><strong>{scanned}{total !== null ? ' / ' + total : ''}</strong></div>
      <div className="oge-workflow-stat"><span className="oge-section-kicker">LEARNED NOTES</span><strong>{learnedCount}</strong></div>
    </div>
    <div className="hub-card oge-module-card oge-study-settings">
      <label htmlFor="vault-daily-goal">Today&apos;s revision goal</label>
      <select id="vault-daily-goal" value={daily.goal} disabled={goalSaving}
        onChange={(event) => void changeDailyGoal(Number(event.target.value))}>
        {[5, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n} Notes</option>)}
      </select>
      <p role="status">{daily.completed} / {daily.goal} unique Notes reviewed today · synced across your devices</p>
      <progress value={Math.min(daily.completed, daily.goal)} max={daily.goal} />
      <div className="oge-study-filters">
        <div><label htmlFor="study-mode">Study mode</label>
          <select id="study-mode" value={mode} onChange={(event) => changeMode(event.target.value)}>
            <option value="due">Review Due</option><option value="all">Study All</option>
          </select></div>
        <div><label htmlFor="study-subject">Subject</label>
          <select id="study-subject" value={subject} onChange={(event) => changeSubject(event.target.value)}>
            <option value="all">All loaded subjects</option>
            {subjectOptions.map((id) => <option key={id} value={id}>{id}</option>)}
          </select></div>
      </div>
      {cursor && <p className="oge-settings-note">Filters and Study All apply to scanned Notes. Scan additional pages below to expand the deck.</p>}
    </div>
    {error && <p role="alert" className="oge-form-error">{error}</p>}
    {message && <p role="status" className="oge-form-success">{message}</p>}
    {loading && !allNotes.length ? <p>Loading your Vault revision queue…</p> : note ? (
      <article className="hub-card oge-module-card oge-study-card">
        <div className="oge-study-card-head"><span className="hub-card-kicker">CARD {activeIndex + 1} OF {ordered.length}</span>
          <span className="hub-card-kicker">SUBJECT · {note.subjectId}</span></div>
        <progress value={activeIndex + 1} max={Math.max(1, ordered.length)} aria-label="Card position" />
        <h2>{note.heading}</h2>
        {note.learned && <p className="oge-settings-note">Learned previously · refresher</p>}
        {!revealed ? <div className="oge-study-hidden"><p>Try recalling the answer before revealing it.</p>
          <button type="button" className="oge-primary-link" onClick={() => setRevealed(true)}>Reveal answer ↓</button>
        </div> : <div className="oge-study-answer oge-notes-preview" dangerouslySetInnerHTML={{ __html: markdownHtml(note.answer) }} />}
        {revealed && <div className="oge-study-ratings">
          {ratings.map((option) => <button key={option.id} type="button" className="oge-settings-secondary-button"
            disabled={saving} onClick={() => void rate(option.id)}><strong>{option.label}</strong><small>{option.hint}</small></button>)}
        </div>}
        <div className="oge-study-navigation">
          <button type="button" className="oge-settings-secondary-button" disabled={saving || activeIndex === 0} onClick={() => navigate(-1)}>← Previous</button>
          <button type="button" className="oge-settings-secondary-button" disabled={saving || ordered.length < 2} onClick={shuffleDeck}>Shuffle</button>
          <button type="button" className="oge-settings-secondary-button" disabled={saving || ordered.length < 2} onClick={skip}>Skip for now →</button>
          <button type="button" className="oge-settings-secondary-button" disabled={saving || activeIndex >= ordered.length - 1} onClick={() => navigate(1)}>Next →</button>
        </div>
      </article>
    ) : <div className="home-dashboard-empty"><strong>{mode === 'all' ? 'No unreviewed Notes in this loaded deck.' : 'No due cards in this loaded deck.'}</strong>
      <p>Try another subject, use Study All, or scan more Notes.</p></div>}
    {!loading && cursor && <button type="button" className="oge-settings-secondary-button" disabled={saving}
      onClick={() => void load(cursor)}>Scan next 20 Notes →</button>}
    <p className="oge-settings-note">Each review is recorded when you choose a rating. Previous, Next, Shuffle and Skip do not save a review.</p>
  </section>;
}
