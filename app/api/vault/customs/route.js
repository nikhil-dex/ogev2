import { auth } from '../../../../auth.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { ownerMutationFilter } from '../../../../lib/active-owner-mutation.js';
import { connectedVaultStorageAvailable } from '../../../../lib/oge-vault-workspace-routing.js';
import { getVaultNoteClient } from '../../../../lib/oge-vault-notes.js';
import { VaultGitHubError } from '../../../../lib/oge-vault-github.js';
import { listVaultCustoms, readVaultCustomFile } from '../../../../lib/customs-library.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const HEADERS = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => Response.json(value, { status, headers: HEADERS });

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) return json({ error: 'Sign in to open Customs.' }, 401);
  try {
    const db = await getDatabase();
    const ownerId = session.user.id, sessionVersion = session.user.sessionVersion;
    const account = await db.collection('users').findOne(
      ownerMutationFilter(ownerId, { sessionVersion }),
      { projection: { notesStorage: 1, vault: 1 } },
    );
    if (!account || !connectedVaultStorageAvailable(account))
      return json({ error: 'Connect your GitHub Vault to use Customs.' }, 403);
    const client = await getVaultNoteClient(db, { ownerId, sessionVersion }, { readOnly: true });
    const name = new URL(request.url).searchParams.get('file');
    if (name === null) return json(await listVaultCustoms(client));
    const { bytes, mime, kind } = await readVaultCustomFile(client, name);
    const headers = {
      ...HEADERS,
      'Content-Type': mime,
      'Content-Length': String(bytes.length),
      'Content-Disposition': 'inline',
      'Referrer-Policy': 'no-referrer',
    };
    if (kind === 'html') {
      // User-authored HTML runs with a unique opaque origin, not the
      // signed-in application's origin. Inline JS is allowed in isolation.
      headers['Content-Security-Policy'] =
        "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
    }
    return new Response(new Uint8Array(bytes), { status: 200, headers });
  } catch (error) {
    if (error instanceof TypeError) return json({ error: 'Unsupported custom file.' }, 400);
    if (error instanceof VaultGitHubError)
      return json({ error: 'Could not read this file from your Vault.' },
        [401, 403, 404, 409, 429].includes(error.status) ? error.status : 503);
    console.error('Vault Customs read failed:', error?.name);
    return json({ error: 'Could not load Customs right now.' }, 503);
  }
}
