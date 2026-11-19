'use client';
import { useEffect, useState } from 'react';
export default function BackupCoverage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetch('/api/vault/backup-manifest', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Could not inspect Vault.');
        return result;
      })
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  if (error) return <p className="oge-form-error" role="status">{error}</p>;
  if (!data) return <p>Inspecting committed Vault files…</p>;
  return <div className="hub-card oge-module-card">
    <span className="hub-card-kicker">READ-ONLY GITHUB VERIFICATION</span>
    <h2>{data.totalCommittedFiles} committed files</h2>
    <p>Branch: <code>{data.branch}</code></p>
    <p>Commit: <code>{data.commitSha.slice(0, 12)}</code></p>
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a className="oge-primary-link"
      href={'/api/vault/backup-snapshot?commit=' + encodeURIComponent(data.commitSha)}>
      ↓ Download this verified snapshot ZIP
    </a>
    <ul>{Object.entries(data.groups).map(([name, count]) =>
      <li key={name}>{name}: {count}</li>)}</ul>
    <p className="oge-settings-note">The snapshot link uses this exact GitHub commit. If the branch changes, refresh the report. This verifies the source tree only; it does not independently verify the downloaded ZIP bytes.</p>
  </div>;
}
