import Link from 'next/link';
import { auth } from '../../../auth.js';
import { redirect } from 'next/navigation';
import { getDatabase } from '../../../lib/mongodb.js';
import { ownerMutationFilter } from '../../../lib/active-owner-mutation.js';
import { vaultNotesAvailable } from '../../../lib/oge-vault-workspace-routing.js';
import SiteNavbar from '../../components/site-navbar';
import VaultStudyClient from './study-client.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vault Study | Oge' };
export default async function VaultStudyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/register');
  const db = await getDatabase();
  const account = await db.collection('users').findOne(
    ownerMutationFilter(session.user.id, { sessionVersion: session.user.sessionVersion }),
    { projection: { notesStorage: 1, vault: 1 } },
  );
  if (account?.notesStorage !== 'github' || !vaultNotesAvailable(account))
    redirect('/vault?setup=onboarding');
  return <main className="shell oge-shell oge-feature-page oge-workflow-page">
    <SiteNavbar actions={<Link className="oge-signin" href="/">Home ↗</Link>} />
    <VaultStudyClient />
  </main>;
}
