'use client';
import { useState } from 'react';
import { inspectVaultZip, planVaultZipRestore } from '../../../lib/oge-vault-zip-restore.js';

async function responseJson(response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || 'Vault recovery request failed.');
  return value;
}

export default function VaultZipRestore() {
  const [plan, setPlan] = useState(null);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  async function inspect(event) {
    const file = event.target.files?.[0];
    setPlan(null); setError(''); setResult(null); setProgress('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Choose a ZIP downloaded from your private GitHub Vault.');
      return;
    }
    setWorking(true);
    try {
      setProgress('Checking ZIP file checksums locally…');
      const archive = await inspectVaultZip(await file.arrayBuffer());
      setProgress('Checking current GitHub Vault files…');
      const current = await responseJson(await fetch('/api/vault/restore', { cache: 'no-store' }));
      setPlan({ ...planVaultZipRestore(archive, current), archiveName: file.name,
        total: archive.files.length, totalBytes: archive.totalBytes });
      setProgress('Backup checked. Review the files before restoring.');
    } catch (err) { setError(err.message || 'Could not read this Vault backup.'); }
    finally { setWorking(false); }
  }
  async function restoreMissing() {
    if (!plan || !plan.missing.length || working || !window.confirm(
      'Restore ' + plan.missing.length + ' missing files to your private GitHub Vault? Existing files will NOT be overwritten.')) return;
    setWorking(true); setError(''); setResult(null);
    try {
      for (let i = 0; i < plan.missing.length; i++) {
        const entry = plan.missing[i];
        setProgress('Uploading verified file ' + (i + 1) + ' of ' + plan.missing.length);
        const result = await responseJson(await fetch('/api/vault/restore?action=blob', {
          method: 'POST', headers: {
            'Content-Type': 'application/octet-stream', 'x-oge-blob-sha': entry.sha,
          }, body: entry.bytes,
        }));
        if (result.sha !== entry.sha) throw new Error('Backup blob did not match its checksum.');
      }
      setProgress('Committing missing files to GitHub Vault…');
      const report = await responseJson(await fetch('/api/vault/restore?action=commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ head: plan.head,
          entries: plan.missing.map(({ path, sha }) => ({ path, sha })) }),
      }));
      setResult(report);
      setPlan(null);
      setProgress('Restore committed. Refresh your Vault pages to see the files.');
    } catch (err) {
      setError(err.message || 'Restore could not be confirmed. Nothing was marked restored.');
      setProgress('No successful restore confirmation. Refresh and inspect the Vault before retrying.');
    } finally { setWorking(false); }
  }
  return <section className="hub-card oge-module-card">
    <span className="hub-card-kicker">RECOVER FROM DOWNLOADED ZIP</span>
    <h2>Restore missing Vault files</h2>
    <p>Choose your GitHub Vault ZIP. Oge checks each file checksum in your browser, compares paths with your current Vault, then restores only missing files.</p>
    <label htmlFor="vault-restore-zip">Select your downloaded backup (.zip)</label>
    <input type="file" id="vault-restore-zip" accept=".zip,application/zip" disabled={working}
      onChange={(event) => { void inspect(event); }} />
    {progress && <p role="status" className="oge-settings-note">{progress}</p>}
    {error && <p role="alert" className="oge-form-error">{error}</p>}
    {plan && <div>
      <p><strong>{plan.archiveName}</strong> · {plan.total} verified files · {(plan.totalBytes / 1048576).toFixed(1)} MB uncompressed</p>
      <p><strong>{plan.missing.length} missing</strong> · {plan.identical.length} already identical · {plan.conflicts.length} conflicts (not replaced)</p>
      {plan.conflicts.length > 0 && <details><summary>Show conflicting paths (not overwritten)</summary>
        <ul>{plan.conflicts.slice(0, 30).map((entry) => <li key={entry.path}>{entry.path}</li>)}</ul>
        {plan.conflicts.length > 30 && <p>And {plan.conflicts.length - 30} more conflicts.</p>}
      </details>}
      <p className="oge-settings-note">Files already in GitHub are never overwritten. If you need older versions, compare the conflicting files manually in GitHub.</p>
      <button type="button" className="oge-primary-link" disabled={working || !plan.missing.length}
        onClick={() => { void restoreMissing(); }}>Restore {plan.missing.length} missing files</button>
    </div>}
    {result && <p className="oge-form-success" role="status">GitHub confirmed {result.restored} restored files in commit {result.commitSha?.slice(0, 12)}.</p>}
    <p className="oge-settings-note">This restores committed repository files, not temporary drafts, login details, or MongoDB-only account settings. Large backups require an uninterrupted browser session.</p>
  </section>;
}
