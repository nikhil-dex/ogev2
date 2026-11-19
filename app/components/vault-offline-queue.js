'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  vaultOfflineQueueKey, readVaultOfflineQueue, enqueueVaultOfflineChange,
  removeVaultOfflineChange, offlineMatchesGitHub, classifyVaultOfflineConflict,
} from '../../lib/oge-vault-offline-queue.js';

async function read(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'GitHub Vault request failed.');
  return body;
}

export default function VaultOfflineQueue({ ownerId, repoId, notesApi, onSynced }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [remote, setRemote] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const key = vaultOfflineQueueKey(ownerId, repoId);
  const reload = useCallback(() => {
    try { setItems(readVaultOfflineQueue(window.localStorage, key)); }
    catch (err) { setError(err.message); }
  }, [key]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) { setOnline(navigator.onLine); reload(); } });
    function changed() { setOnline(navigator.onLine); reload(); }
    window.addEventListener('online', changed);
    window.addEventListener('offline', changed);
    window.addEventListener('storage', changed);
    window.addEventListener('oge:vault-offline-changed', changed);
    return () => {
      active = false;
      window.removeEventListener('online', changed);
      window.removeEventListener('offline', changed);
      window.removeEventListener('storage', changed);
      window.removeEventListener('oge:vault-offline-changed', changed);
    };
  }, [reload]);

  async function currentGitHub(item) {
    try {
      const response = await fetch(notesApi + '?id=' + encodeURIComponent(item.id),
        { cache: 'no-store' });
      if (response.status === 404) return null;
      return await read(response);
    } catch (err) {
      throw new Error('Cannot verify this Note with GitHub. Reconnect before syncing.', { cause: err });
    }
  }

  async function check(item) {
    setBusy(true); setSelected(null); setRemote(null); setStatus(''); setError('');
    try {
      const latest = await currentGitHub(item);
      setSelected(item);
      setRemote(latest);
      setStatus(classifyVaultOfflineConflict(item, latest));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function save(useOfflineVersion) {
    if (!selected || busy) return;
    if (status === 'conflict' && !useOfflineVersion) return;
    if (status === 'conflict' && (!remote || selected.action !== 'update' ||
      remote.subjectSlug !== selected.subjectId ||
      !window.confirm('Replace the newer GitHub Note with your offline version? GitHub will retain commit history.')))
      return;
    setBusy(true); setError('');
    try {
      // Re-read immediately before saving. The server also enforces the
      // expected SHA on PUT. No offline change auto-syncs.
      const latest = await currentGitHub(selected);
      if (selected.action === 'create' ? latest !== null :
        latest === null || latest.subjectSlug !== selected.subjectId ||
        (status !== 'conflict' && latest.sha !== selected.baseSha) ||
        (status === 'conflict' && latest.sha !== remote?.sha))
        throw new Error('GitHub changed since your review. Check this Note again.');
      const payload = {
        subjectSlug: selected.subjectId, heading: selected.heading,
        answer: selected.answer, tags: selected.tags,
      };
      const method = selected.action === 'create' ? 'POST' : 'PUT';
      const response = await fetch(notesApi, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected.action === 'create' ?
          { ...payload, id: selected.id } :
          { ...payload, id: selected.id, sha: latest.sha }),
      });
      const committed = await read(response);
      if (committed.id !== selected.id || !committed.sha)
        throw new Error('GitHub did not confirm your Note version.');
      setItems(removeVaultOfflineChange(window.localStorage, key, selected.id));
      setSelected(null); setRemote(null); setStatus('');
      window.dispatchEvent(new Event('oge:vault-offline-changed'));
      await onSynced();
    } catch (err) { setError(err.message || 'No GitHub confirmation. Your local edit is retained.'); }
    finally { setBusy(false); }
  }

  async function clearAlreadySaved() {
    if (!selected || status !== 'already-synced' || busy) return;
    setBusy(true); setError('');
    try {
      const latest = await currentGitHub(selected);
      if (!offlineMatchesGitHub(selected, latest))
        throw new Error('GitHub changed. Review this Note again before removing the queue entry.');
      setItems(removeVaultOfflineChange(window.localStorage, key, selected.id));
      setSelected(null); setRemote(null); setStatus('');
      window.dispatchEvent(new Event('oge:vault-offline-changed'));
      await onSynced();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function keepBoth() {
    if (!selected || status !== 'conflict' || busy ||
        !window.confirm('Keep the current GitHub Note and create a separate Note from your offline text?')) return;
    try {
      const duplicate = { ...selected, id: crypto.randomUUID(),
        action: 'create', baseSha: null };
      // Queue the new stable ID before removing the old one; never discard
      // the original unless the new local copy is durable.
      enqueueVaultOfflineChange(window.localStorage, key, duplicate);
      setItems(removeVaultOfflineChange(window.localStorage, key, selected.id));
      setSelected(null); setRemote(null); setStatus('');
      setError('');
      window.dispatchEvent(new Event('oge:vault-offline-changed'));
    } catch (err) { setError(err.message || 'Could not preserve your separate Note.'); }
  }

  function discard(item) {
    if (!window.confirm('Discard this local offline edit? This cannot be undone.')) return;
    try {
      setItems(removeVaultOfflineChange(window.localStorage, key, item.id));
      setSelected(null); setRemote(null); setStatus('');
      window.dispatchEvent(new Event('oge:vault-offline-changed'));
    } catch (err) { setError(err.message); }
  }

  if (!items.length && !error) return null;
  return <section className="oge-module-section" aria-label="Pending offline GitHub Vault Notes">
    <div className="oge-section-heading"><div>
      <span className="oge-section-kicker">LOCAL BROWSER CHANGES · {online ? 'ONLINE' : 'OFFLINE'}</span>
      <h2>Offline Notes ({items.length})</h2>
      <p>Saved in this browser until you review and sync to GitHub. Nothing syncs automatically.</p>
    </div></div>
    {error && <p className="oge-form-error" role="alert">{error}</p>}
    {items.map((item) => <div key={item.id} className="hub-card oge-module-card">
      <strong>{item.heading}</strong>
      <span> · {item.action === 'create' ? 'New Note' : 'Edit existing Note'}</span>
      <div className="oge-settings-data-actions">
        <button type="button" className="oge-settings-secondary-button" disabled={!online || busy}
          onClick={() => { void check(item); }}>Review &amp; sync</button>
        <button type="button" className="oge-settings-secondary-button" disabled={busy}
          onClick={() => discard(item)}>Discard local copy</button>
      </div>
    </div>)}
    {selected && <div className="hub-card oge-module-card">
      <h3>Review: {selected.heading}</h3>
      <p>{status === 'ready' ? 'GitHub is unchanged. You can save this version.' :
        status === 'already-synced' ? 'GitHub already contains this exact Note. No second save is needed.' :
        'Conflict: the GitHub Note was changed, deleted or recreated. Nothing will be overwritten automatically.'}</p>
      <details open><summary>Your offline version</summary><p style={{ whiteSpace: 'pre-wrap' }}>{selected.answer}</p></details>
      {remote && <details><summary>Current GitHub version</summary><p style={{ whiteSpace: 'pre-wrap' }}>{remote.answer}</p></details>}
      <div className="oge-settings-data-actions">
        {status === 'ready' && <button type="button" disabled={busy}
          onClick={() => { void save(false); }}>Save reviewed version to GitHub</button>}
        {status === 'already-synced' && <button type="button" disabled={busy}
          onClick={() => { void clearAlreadySaved(); }}>Confirm already saved &amp; clear pending</button>}
        {status === 'conflict' && <button type="button" disabled={busy}
          onClick={keepBoth}>Keep both as separate Notes</button>}
        {status === 'conflict' && remote && selected.action === 'update' &&
          remote.subjectSlug === selected.subjectId &&
          <button type="button" disabled={busy} onClick={() => { void save(true); }}>
            Use my offline version (replace current GitHub Note)
          </button>}
        <button type="button" disabled={busy} onClick={() => discard(selected)}>
          Keep GitHub / discard offline edit</button>
      </div>
    </div>}
  </section>;
}
