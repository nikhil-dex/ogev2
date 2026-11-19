'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

async function json(response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || 'Could not load study notes.');
  return value;
}

export default function VaultStudyClient() {
  const [notes, setNotes] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [completed, setCompleted] = useState(0);
  const load = useCallback(async (next = null) => {
    setLoading(true); setError('');
    try {
      const page = await json(await fetch('/api/vault/study' +
        (next ? '?cursor=' + encodeURIComponent(next) : ''), { cache: 'no-store' }));
      setNotes(page.notes.filter((note) => note.due));
      setCursor(page.nextCursor);
      setRevealed(false);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);
  const note = notes[0] || null;

  async function rate(rating) {
    if (!note || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const result = await json(await fetch('/api/vault/study', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: note.id, rating }),
      }));
      setNotes((items) => items.filter((item) => item.id !== note.id));
      setCompleted((n) => n + 1);
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
      </div>
      {error && <p role="alert" className="oge-form-error">{error}</p>}
      {message && <p role="status" className="oge-form-success">{message}</p>}
      {loading ? <p>Loading your Vault revision queue…</p> : note ? (
        <div className="hub-card oge-module-card">
          <span className="hub-card-kicker">SUBJECT · {note.subjectId}</span>
          <h2>{note.heading}</h2>
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
        <button type="button" className="oge-settings-secondary-button" onClick={() => load(cursor)}>Load next 20 notes →</button>}
      <p className="oge-settings-note">This is a paged queue. Use the next-page control to continue through larger Vault libraries.</p>
    </section>
  );
}
