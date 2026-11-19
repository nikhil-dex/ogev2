import { auth } from '../../../../auth.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { ownerMutationFilter } from '../../../../lib/active-owner-mutation.js';
import { connectedVaultStorageAvailable } from '../../../../lib/oge-vault-workspace-routing.js';
import { getVaultNoteClient } from '../../../../lib/oge-vault-notes.js';
import { readVaultBackupManifest } from '../../../../lib/oge-vault-backup-manifest.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return json({ error: 'Sign in to inspect your backup.' }, 401);
  try {
    const db = await getDatabase();
    const ownerId = session.user.id, sessionVersion = session.user.sessionVersion;
    const account = await db.collection('users').findOne(
      ownerMutationFilter(ownerId, { sessionVersion }),
      { projection: { notesStorage: 1, vault: 1 } },
    );
    if (account?.notesStorage !== 'github' || !connectedVaultStorageAvailable(account))
      return json({ error: 'Connect GitHub Vault first.' }, 403);
    const client = await getVaultNoteClient(db, { ownerId, sessionVersion }, { readOnly: true });
    return json(await readVaultBackupManifest(client));
  } catch (error) {
    console.error('Vault backup manifest failed:', error?.name);
    return json({ error: 'Could not verify a complete committed Vault tree.' }, 503);
  }
}
