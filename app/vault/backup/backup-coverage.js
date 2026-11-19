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
    <ul>{Object.entries(data.groups).map(([name, count]) =>
      <li key={name}>{name}: {count}</li>)}</ul>
    <p className="oge-settings-note">These counts confirm the repository tree could be enumerated. They do not verify a downloaded ZIP or its contents.</p>
  </div>;
}
