import Link from 'next/link';
import { auth } from '../../../auth.js';
import { redirect } from 'next/navigation';
import { getDatabase } from '../../../lib/mongodb.js';
import { ownerMutationFilter } from '../../../lib/active-owner-mutation.js';
import { connectedVaultStorageAvailable } from '../../../lib/oge-vault-workspace-routing.js';
import SiteNavbar from '../../components/site-navbar.js';
import BackupCoverage from './backup-coverage.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vault Backup | Oge', robots: { index: false } };
export default async function VaultBackupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');
  const db = await getDatabase();
  const account = await db.collection('users').findOne(
    ownerMutationFilter(session.user.id, { sessionVersion: session.user.sessionVersion }),
    { projection: { notesStorage: 1, vault: 1 } },
  );
  if (account?.notesStorage !== 'github' || !connectedVaultStorageAvailable(account))
    redirect('/vault?setup=onboarding');
  return <main className="shell oge-shell oge-feature-page oge-workflow-page">
    <SiteNavbar actions={<Link className="oge-signin" href="/vault">Back to Vault →</Link>} />
    <section className="oge-module-section">
      <span className="oge-section-kicker">YOUR GITHUB VAULT</span>
      <h1>Backup &amp; Recovery<span>.</span></h1>
      <p>Back up your entire committed private GitHub repository, including Notes, Quick Notes, AirNotes, Saved Links, My Files and Customs. Unsaved drafts and account settings outside GitHub are not included.</p>
      <BackupCoverage />
      {/* Native download redirects to the signed-in owner's private GitHub repository. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="oge-primary-link" href="/api/vault/backup-zip">↓ Download complete Vault ZIP</a>
      <div className="hub-card oge-module-card">
        <h2>How to recover from this backup</h2>
        <p>Keep the ZIP privately. If you need to restore, sign in to your GitHub Vault repository, confirm the correct repository and branch, and upload the extracted files back into your own repository using GitHub or Git. Refresh OgeV2 after the commits are visible.</p>
        <p className="oge-settings-note">This is a manual recovery path. OgeV2 does not yet safely perform a full automatic ZIP restore. Verify your ZIP before replacing existing GitHub files and keep the current version until recovery is confirmed.</p>
      </div>
    </section>
  </main>;
}
