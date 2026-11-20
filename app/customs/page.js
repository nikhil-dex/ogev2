import Link from 'next/link';
import { auth } from '../../auth.js';
import { redirect } from 'next/navigation';
import { getDatabase } from '../../lib/mongodb.js';
import { ownerMutationFilter } from '../../lib/active-owner-mutation.js';
import { connectedVaultStorageAvailable } from '../../lib/oge-vault-workspace-routing.js';
import { getVaultNoteClient } from '../../lib/oge-vault-notes.js';
import { getIndexedCustoms } from '../../lib/customs-index.js';
import SiteNavbar from '../components/site-navbar';

export const metadata = { title: 'Custom Pages | Oge' };
export const dynamic = 'force-dynamic';

export default async function CustomsPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');
  const db = await getDatabase();
  const ownerId = session.user.id, sessionVersion = session.user.sessionVersion;
  const account = await db.collection('users').findOne(
    ownerMutationFilter(ownerId, { sessionVersion }),
    { projection: { vault: 1, notesStorage: 1 } },
  );
  if (!account) redirect('/register');
  if (account.notesStorage !== 'github') redirect('/');
  const connected = connectedVaultStorageAvailable(account);
  let customs = null;
  let error = '';
  if (connected) {
    try {
      const client = await getVaultNoteClient(db, { ownerId, sessionVersion }, { readOnly: true });
      const params = await searchParams;
      customs = await getIndexedCustoms(db, client, ownerId, { refresh: params?.refresh === 'true' });
    } catch (failure) {
      console.error('Could not index private Vault Customs:', failure?.name);
      error = 'Could not check your Customs files. Check the GitHub Vault connection and try Refresh.';
    }
  }
  return (
    <main className="shell oge-shell oge-retro-workspace">
      <SiteNavbar actions={<Link className="oge-signin" href="/">Back to dashboard ↗</Link>} />
      <section className="oge-module-section" aria-labelledby="customs-title">
        <div className="oge-section-heading">
          <div><span className="oge-section-kicker">YOUR PRIVATE GITHUB VAULT</span>
            <h1 id="customs-title">Custom Pages<span>.</span></h1>
            <p>Your HTML pages, PDFs and images from the root <code>customs/</code> folder of your own Vault repository.</p>
          </div>
          {connected && <Link className="oge-primary-link" href="/customs?refresh=true">↻ Refresh files</Link>}
        </div>
        {!connected ? (
          <div className="home-dashboard-empty">
            <strong>Connect your GitHub Vault first.</strong>
            <p>Customs reads files from your private Vault repository, not from OgeV2 source code.</p>
            <Link className="home-dashboard-action-link" href="/vault">Open Vault setup →</Link>
          </div>
        ) : error ? <p className="home-dashboard-error" role="status">{error}</p> : !customs?.exists ? (
          <div className="home-dashboard-empty">
            <strong>No customs folder detected yet.</strong>
            <p>Create a folder named <code>customs</code> at the root of your private <code>ogenotes-vault</code> repository, commit an HTML, PDF or image file, then click Refresh files.</p>
          </div>
        ) : customs.files.length ? (
          <div className="hub-grid oge-module-grid">
            {customs.files.map((file) => (
              <a key={file.name} className="hub-card oge-module-card" href={file.url}
                target="_blank" rel="noopener noreferrer">
                <div className="oge-module-card-top"><span className="oge-module-icon" aria-hidden="true">{file.type === 'html' ? '⌘' : file.type === 'pdf' ? '▤' : '▧'}</span><span className="hub-card-kicker">{file.type.toUpperCase()}</span></div>
                <h3>{file.title} <span aria-hidden="true">↗</span></h3>
                <p>{file.name}</p><span className="hub-card-link">Open file →</span>
              </a>
            ))}
          </div>
        ) : <p className="home-dashboard-empty">The folder exists but has no supported files yet.</p>}
        {customs?.stale && <p className="home-dashboard-error" role="status">GitHub is temporarily unavailable. Showing the last indexed file list; previews still require GitHub access. Try Refresh again later.</p>}
        {customs && <p className="oge-settings-note">Last checked: {new Date(customs.indexedAt).toLocaleString('en-IN')}. {customs.source === 'index' ? 'Using the saved file index.' : 'Indexed from GitHub Vault.'} Files stay in GitHub; MongoDB stores only the file list.</p>}
      </section>
    </main>
  );
}
