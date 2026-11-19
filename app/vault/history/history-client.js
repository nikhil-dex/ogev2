'use client';
import { useEffect, useState } from 'react';

async function read(response) {
  const v = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(v.error || 'Could not load GitHub revisions.');
  return v;
}
export default function VaultHistoryClient() {
  const [notes, setNotes] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    read(fetch('/api/vault/notes-main?paged=true&limit=20', { cache: 'no-store' }))
      .then((v) => { if (active) { setNotes(v.notes); setCursor(v.nextCursor); } })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  async function loadHistory(id) {
    setSelectedId(id); setHistory(null); setError(''); setMessage('');
    if (!id) return;
    setBusy(true);
    try {
      setHistory(await read(await fetch('/api/vault/revision-history?id=' +
        encodeURIComponent(id), { cache: 'no-store' })));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const page = await read(await fetch('/api/vault/notes-main?paged=true&limit=20&cursor=' +
        encodeURIComponent(cursor), { cache: 'no-store' }));
      setNotes((old) => [...old, ...page.notes.filter((n) => !old.some((x) => x.id === n.id))]);
      setCursor(page.nextCursor);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function restore(entry) {
    if (!history || entry.isCurrent || busy ||
      !window.confirm('Restore this earlier GitHub Note version? Any unsaved draft must be saved or resolved first.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await read(await fetch('/api/vault/revision-history', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedId, sha: history.currentSha,
          commitSha: entry.commitSha, sourceSha: entry.sha,
        }),
      }));
      setMessage('Previous version committed to your GitHub Vault.');
      setHistory(await read(await fetch('/api/vault/revision-history?id=' +
        encodeURIComponent(selectedId), { cache: 'no-store' })));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="oge-module-section">
    <span className="oge-section-kicker">PRIVATE GITHUB HISTORY</span>
    <h1>Note History<span>.</span></h1>
    <p>Choose a committed Note to view recent GitHub versions and optionally restore one.</p>
    {error && <p className="oge-form-error" role="alert">{error}</p>}
    {message && <p className="oge-form-success" role="status">{message}</p>}
    <label htmlFor="vault-history-note">Choose note</label>
    <select id="vault-history-note" value={selectedId} disabled={busy}
      onChange={(e) => void loadHistory(e.target.value)}>
      <option value="">Select a note…</option>
      {notes.map((note) => <option key={note.id} value={note.id}>{note.heading}</option>)}
    </select>
    {cursor && <button type="button" className="oge-settings-secondary-button"
      disabled={busy} onClick={() => void loadMore()}>Load more Notes</button>}
    {history && <div className="hub-grid oge-module-grid">
      {history.items.map((entry) => <div key={entry.commitSha} className="hub-card oge-module-card">
        <span className="hub-card-kicker">{entry.isCurrent ? 'CURRENT' : 'PREVIOUS VERSION'}</span>
        <h2>{entry.heading}</h2>
        <p>{new Date(entry.updatedAt).toLocaleString('en-IN')}</p>
        <details><summary>Read version</summary><p style={{ whiteSpace: 'pre-wrap' }}>{entry.answer}</p></details>
        {!entry.isCurrent && <button type="button" disabled={busy} className="oge-settings-secondary-button"
          onClick={() => void restore(entry)}>Restore this version</button>}
      </div>)}
    </div>}
    {history?.moreMayExist && <p className="oge-settings-note">Showing recent history only; older GitHub commits may also exist.</p>}
  </section>;
}
