'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { markdownHtml } from '../../../lib/markdown.js';

async function read(response) {
  const v = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(v.error || 'Could not load GitHub revisions.');
  return v;
}
function formattedDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' :
    date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
function MarkdownVersion({ title, entry, variant }) {
  return <article className={'oge-vh-pane oge-vh-pane-' + variant}>
    <div className="oge-vh-pane-head"><span>{title}</span><span>{formattedDate(entry.updatedAt)}</span></div>
    <h3>{entry.heading || 'Untitled Note'}</h3>
    <div className="oge-vh-markdown" dangerouslySetInnerHTML={{ __html: markdownHtml(entry.answer || '') }} />
  </article>;
}
export default function VaultHistoryClient() {
  const [notes, setNotes] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState(null);
  const [selectedCommit, setSelectedCommit] = useState('');
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const requestRef = useRef(0);
  const historyRef = useRef(null);
  const subjectOptions = useMemo(() => Array.from(new Set(notes.map((n) =>
    n.subjectSlug || n.subjectId).filter(Boolean))).sort(), [notes]);
  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes.filter((n) => (subjectFilter === 'all' ||
      (n.subjectSlug || n.subjectId) === subjectFilter) &&
      (!needle || [n.heading, n.answer, n.subjectSlug, n.subjectId].some((value) =>
        String(value || '').toLowerCase().includes(needle))));
  }, [notes, query, subjectFilter]);
  const current = history?.items?.find((entry) => entry.isCurrent) || null;
  const selected = history?.items?.find((entry) => entry.commitSha === selectedCommit) || null;
  useEffect(() => {
    let active = true;
    fetch('/api/vault/notes-main?paged=true&limit=20', { cache: 'no-store' }).then(read)
      .then((v) => { if (active) { setNotes(v.notes || []); setCursor(v.nextCursor || null); } })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoadingNotes(false); });
    return () => { active = false; requestRef.current += 1; };
  }, []);
  async function loadHistory(id) {
    const request = ++requestRef.current;
    setSelectedId(id); setHistory(null); setSelectedCommit(''); setError(''); setMessage('');
    if (!id) return;
    setBusy(true);
    try {
      const result = await read(await fetch('/api/vault/revision-history?id=' +
        encodeURIComponent(id), { cache: 'no-store' }));
      if (request !== requestRef.current) return;
      setHistory(result);
      setSelectedCommit(result.items.find((item) => !item.isCurrent)?.commitSha ||
        result.items[0]?.commitSha || '');
      historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { if (request === requestRef.current) setError(err.message); }
    finally { if (request === requestRef.current) setBusy(false); }
  }
  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const page = await read(await fetch('/api/vault/notes-main?paged=true&limit=20&cursor=' +
        encodeURIComponent(cursor), { cache: 'no-store' }));
      setNotes((old) => [...old, ...(page.notes || []).filter((n) =>
        !old.some((x) => x.id === n.id))]);
      setCursor(page.nextCursor || null);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function restore(entry) {
    if (!history || entry.isCurrent || busy ||
      !window.confirm('Restore this earlier GitHub Note version? Unsaved drafts must be resolved first. The current committed version remains in Git history.')) return;
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
      const refreshed = await read(await fetch('/api/vault/revision-history?id=' +
        encodeURIComponent(selectedId), { cache: 'no-store' }));
      setHistory(refreshed);
      setSelectedCommit(refreshed.items.find((item) => !item.isCurrent)?.commitSha || '');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="oge-module-section oge-vh">
    <div className="oge-vh-intro">
      <span className="oge-section-kicker">PRIVATE GITHUB HISTORY</span>
      <h1>Note History<span>.</span></h1>
      <p>Find a Note, compare a previous version with the current version, then restore only when you are ready.</p>
    </div>
    {error && <p className="oge-form-error" role="alert">{error}</p>}
    {message && <p className="oge-form-success" role="status">{message}</p>}
    <div className="oge-vh-layout">
      <aside className="oge-vh-sidebar" aria-label="Choose a Note">
        <div className="oge-vh-section-heading"><h2>Your Notes</h2><span>{visibleNotes.length} loaded match(es)</span></div>
        <label htmlFor="vault-history-search">Search Notes</label>
        <input id="vault-history-search" type="search" placeholder="Find a title or phrase…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <label htmlFor="vault-history-subject">Subject</label>
        <select id="vault-history-subject" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
          <option value="all">All loaded subjects</option>
          {subjectOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <div className="oge-vh-note-list">
          {visibleNotes.map((note) => <button key={note.id} type="button"
            className={'oge-vh-note' + (note.id === selectedId ? ' is-selected' : '')}
            onClick={() => void loadHistory(note.id)} aria-pressed={note.id === selectedId}>
            <strong>{note.heading || 'Untitled Note'}</strong>
            <span>{note.subjectSlug || note.subjectId || 'Note'}</span>
          </button>)}
          {!loadingNotes && !visibleNotes.length && <p className="oge-vh-muted">No matching loaded Notes.</p>}
          {loadingNotes && <p className="oge-vh-muted">Loading Notes…</p>}
        </div>
        {cursor && <button type="button" className="oge-settings-secondary-button"
          disabled={busy} onClick={() => void loadMore()}>Load more Notes</button>}
        {cursor && <p className="oge-vh-muted">Search and subject filters cover loaded Notes. Load more to search older Notes.</p>}
      </aside>
      <div className="oge-vh-main" ref={historyRef}>
        <div className="oge-vh-section-heading"><h2>Version history</h2><span>{history?.items?.length || 0} versions shown</span></div>
        {!history && <div className="oge-vh-empty">{busy ? 'Loading saved versions…' : 'Select a Note to view its history.'}</div>}
        {history && <>
          <div className="oge-vh-timeline" aria-label="Recent Note versions">
            {history.items.map((entry) => <button key={entry.commitSha} type="button"
              className={'oge-vh-version' + (entry.commitSha === selectedCommit ? ' is-selected' : '')}
              onClick={() => setSelectedCommit(entry.commitSha)} aria-pressed={entry.commitSha === selectedCommit}>
              <span>{entry.isCurrent ? 'Current' : 'Previous'}</span>
              <strong>{entry.heading || 'Untitled Note'}</strong>
              <small>{formattedDate(entry.updatedAt)}</small>
            </button>)}
          </div>
          {current && selected && <div className="oge-vh-compare">
            <div className="oge-vh-section-heading"><h2>Compare versions</h2><span>Read before restoring</span></div>
            <div className="oge-vh-panes">
              <MarkdownVersion title="Current version" entry={current} variant="current" />
              <MarkdownVersion title={selected.isCurrent ? 'Current selection' : 'Selected earlier version'} entry={selected} variant="previous" />
            </div>
            <div className="oge-vh-actions">
              <span>Only a confirmed Restore writes a new GitHub commit.</span>
              <button type="button" className="oge-settings-secondary-button"
                disabled={busy || selected.isCurrent || selected.sha === history.currentSha}
                onClick={() => void restore(selected)}>{busy ? 'Working…' : 'Restore selected version'}</button>
            </div>
          </div>}
          {history.moreMayExist && <p className="oge-vh-muted" role="status">Showing a limited window of recent GitHub commits. Older versions may exist; they are not yet displayed.</p>}
        </>}
      </div>
    </div>
  </section>;
}
