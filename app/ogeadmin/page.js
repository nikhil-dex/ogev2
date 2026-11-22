import { notFound } from 'next/navigation';
import { requireOgeAdmin } from '../../lib/oge-admin.js';
import { revokeAccountSessions } from './actions.js';

export const metadata = { title: 'Administration · Oge', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
function plain(value) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 90);
}
function date(value) {
  if (!value) return '—';
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? '—' : result.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function adminSearchFilter(q) {
  if (!q) return {};
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $or: [
    { email: { $regex: escaped, $options: 'i' } },
    { username: { $regex: escaped, $options: 'i' } },
    { name: { $regex: escaped, $options: 'i' } },
  ] };
}
export default async function OgeAdminPage({ searchParams }) {
  const admin = await requireOgeAdmin();
  if (!admin) notFound();
  const query = await searchParams;
  const search = plain(query?.q);
  const page = Math.min(10000, Math.max(1, Number.parseInt(String(query?.page || '1'), 10) || 1));
  const filter = adminSearchFilter(search);
  const users = admin.db.collection('users');
  const [totalUsers, githubUsers, cloudUsers, tracks, totalMatches, records] = await Promise.all([
    users.countDocuments({}),
    users.countDocuments({ notesStorage: 'github' }),
    users.countDocuments({ notesStorage: 'mongodb' }),
    admin.db.collection('learningTracks').estimatedDocumentCount(),
    users.countDocuments(filter),
    users.find(filter, { projection: {
      googleSub: 1, email: 1, name: 1, displayName: 1, username: 1,
      notesStorage: 1, onboardingComplete: 1, createdAt: 1, lastLoginAt: 1,
    } }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
  ]);
  const status = { revoked: 'All existing sessions for that account were revoked.',
    self: 'The administrator account cannot be revoked here.',
    missing: 'Account not found or changed. Nothing was revoked.',
    invalid: 'Invalid confirmation. Nothing was changed.' }[query?.status];

  return (
    <main className="oge-admin">
      <header className="oge-admin-top"><div><span className="oge-admin-eyebrow">OGE / PRIVATE</span><h1>Administration<span>.</span></h1><p>Accounts and workspace overview</p></div>
        <div className="oge-admin-identity">Signed in as <strong>{admin.email}</strong></div></header>
      <section className="oge-admin-stats" aria-label="System overview">
        <article><span>Accounts</span><strong>{totalUsers}</strong></article>
        <article><span>GitHub Notes users</span><strong>{githubUsers}</strong></article>
        <article><span>Oge Cloud users</span><strong>{cloudUsers}</strong></article>
        <article><span>Learning tracks</span><strong>{tracks}</strong></article>
      </section>
      <section className="oge-admin-section" aria-labelledby="accounts-heading">
        <div className="oge-admin-heading"><div><span className="oge-admin-eyebrow">MANAGEMENT</span><h2 id="accounts-heading">User accounts</h2><p>Search accounts and revoke sessions. Notes and files remain private.</p></div></div>
        {status && <p className="oge-admin-alert" role="status">{status}</p>}
        <form method="GET" action="/ogeadmin" className="oge-admin-search">
          <label htmlFor="admin-search">Search email, username or name</label>
          <div><input id="admin-search" name="q" defaultValue={search} maxLength={90} placeholder="Search users…" /><button type="submit">Search</button></div>
        </form>
        <div className="oge-admin-count">{totalMatches} matching account{totalMatches === 1 ? '' : 's'} · Page {page}</div>
        <div className="oge-admin-table-wrap">
          <table className="oge-admin-table"><thead><tr><th>Account</th><th>Storage</th><th>Setup</th><th>Joined</th><th>Last sign-in</th><th>Action</th></tr></thead>
            <tbody>{records.map((user) => <tr key={String(user._id)}>
              <td><strong>{user.displayName || user.name || user.username || 'Unnamed user'}</strong><small>{user.email || 'No email'}</small></td>
              <td>{user.notesStorage === 'github' ? 'GitHub' : user.notesStorage === 'mongodb' ? 'Oge Cloud' : 'Not selected'}</td>
              <td>{user.onboardingComplete ? 'Complete' : 'Pending'}</td>
              <td>{date(user.createdAt)}</td><td>{date(user.lastLoginAt)}</td>
              <td>{user.googleSub === admin.ownerId || user.email?.trim().toLowerCase() === admin.email
                ? <span className="oge-admin-muted">Admin</span>
                : <form action={revokeAccountSessions}>
                  <input type="hidden" name="account" value={user.googleSub} />
                  <input type="hidden" name="confirmation" value="REVOKE" />
                  <label className="oge-admin-confirm"><input type="checkbox" required /> Confirm</label>
                  <button type="submit" className="oge-admin-revoke" title="Sign out this account from all existing sessions">Revoke sessions</button>
                </form>}</td>
            </tr>)}
            {records.length === 0 && <tr><td colSpan="6">No accounts found.</td></tr>}
            </tbody></table>
        </div>
        <nav className="oge-admin-pagination" aria-label="Account pages">
          {page > 1 && <a href={`/ogeadmin?page=${page-1}&q=${encodeURIComponent(search)}`}>← Previous</a>}
          {page * PAGE_SIZE < totalMatches && <a href={`/ogeadmin?page=${page+1}&q=${encodeURIComponent(search)}`}>Next →</a>}
        </nav>
        <p className="oge-admin-footnote">Revoking sessions signs a user out of their existing devices. They can sign in again. This does not delete their data or disable their account.</p>
      </section>
    </main>
  );
}
