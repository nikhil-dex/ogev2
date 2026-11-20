import Link from 'next/link';
import { auth } from '../../../auth.js';
import { redirect } from 'next/navigation';
import { getDatabase } from '../../../lib/mongodb.js';
import { ownerMutationFilter } from '../../../lib/active-owner-mutation.js';
import { vaultNotesAvailable } from '../../../lib/oge-vault-workspace-routing.js';
import SiteNavbar from '../../components/site-navbar';
import VaultHistoryClient from './history-client.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Note History | Oge' };
export default async function VaultHistoryPage() {
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
    <SiteNavbar actions={<Link className="oge-signin" href="/vault/notes">Back to Notes →</Link>} />
    <VaultHistoryClient />
  </main>;
}
