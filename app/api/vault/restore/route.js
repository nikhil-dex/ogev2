import { auth } from '../../../../auth.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { ownerMutationFilter } from '../../../../lib/active-owner-mutation.js';
import { connectedVaultStorageAvailable } from '../../../../lib/oge-vault-workspace-routing.js';
import { getVaultNoteClient } from '../../../../lib/oge-vault-notes.js';
import { readLimitedBody } from '../../../../lib/read-limited-body.js';
import { checkOwnerMutationLimit, rateLimitResponse } from '../../../../lib/rate-limit.js';
import {
  readVaultRestoreTree, uploadVaultRestoreBlob, commitVaultRestore,
  MAX_RESTORE_BLOB_BYTES,
} from '../../../../lib/oge-vault-restore-commit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (data, status = 200) => Response.json(data, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});

async function context(readOnly) {
  const session = await auth();
  if (!session?.user?.id) return { response: reply({ error: 'Sign in to recover your Vault.' }, 401) };
  const db = await getDatabase();
  const ownerId = session.user.id, sessionVersion = session.user.sessionVersion;
  const account = await db.collection('users').findOne(
    ownerMutationFilter(ownerId, { sessionVersion }),
    { projection: { notesStorage: 1, vault: 1 } },
  );
  if (account?.notesStorage !== 'github' || !connectedVaultStorageAvailable(account))
    return { response: reply({ error: 'Connect your GitHub Vault to restore.' }, 403) };
  const client = await getVaultNoteClient(db, { ownerId, sessionVersion }, { readOnly });
  return { db, ownerId, client };
}

function failure(error) {
  if (error instanceof SyntaxError || error instanceof TypeError)
    return reply({ error: error.message || 'Invalid backup request.' }, 400);
  console.error('Vault ZIP restore error:', error?.name);
  return reply({ error: 'GitHub restore could not be completed. Check the Vault and retry after refreshing.' }, 503);
}

export async function GET() {
  try {
    const ctx = await context(true);
    if (ctx.response) return ctx.response;
    const index = await readVaultRestoreTree(ctx.client);
    return reply({ head: index.head, files: index.files });
  } catch (error) { return failure(error); }
}

export async function POST(request) {
  try {
    const ctx = await context(false);
    if (ctx.response) return ctx.response;
    const throttle = await checkOwnerMutationLimit(ctx.db, ctx.ownerId, 'media');
    if (!throttle.allowed) return rateLimitResponse(throttle);
    const operation = new URL(request.url).searchParams.get('action');
    if (operation === 'blob') {
      const length = Number(request.headers.get('content-length') || 0);
      if (length > MAX_RESTORE_BLOB_BYTES)
        return reply({ error: 'Backup file is too large.' }, 413);
      const bytes = Buffer.from(await request.arrayBuffer());
      if (bytes.length > MAX_RESTORE_BLOB_BYTES)
        return reply({ error: 'Backup file must be at most 20 MB.' }, 413);
      const sha = request.headers.get('x-oge-blob-sha');
      return reply(await uploadVaultRestoreBlob(ctx.client, bytes, sha));
    }
    if (operation === 'commit') {
      const input = JSON.parse(await readLimitedBody(request, 1024 * 1024));
      const result = await commitVaultRestore(ctx.client, input);
      return reply(result, result.conflict ? 409 : 200);
    }
    return reply({ error: 'Unknown restore operation.' }, 400);
  } catch (error) { return failure(error); }
}
