import { auth } from '../../../../auth.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { ownerMutationFilter } from '../../../../lib/active-owner-mutation.js';
import { getVaultNoteClient } from '../../../../lib/oge-vault-notes.js';
import { githubVaultFilesEnabled } from '../../../../lib/oge-vault-media-validation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const SHA = /^[a-f0-9]{40}$/i;
const fail = (message, status) => Response.json({ error: message }, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) return fail('Sign in to download a Vault snapshot.', 401);
  const expected = new URL(request.url).searchParams.get('commit');
  if (!SHA.test(expected || '')) return fail('Choose a verified backup snapshot.', 400);
  try {
    const db = await getDatabase();
    const ownerId = session.user.id, sessionVersion = session.user.sessionVersion;
    const account = await db.collection('users').findOne(
      ownerMutationFilter(ownerId, { sessionVersion }),
      { projection: { notesStorage: 1, vault: 1 } },
    );
    if (account?.notesStorage !== 'github' || !githubVaultFilesEnabled(account))
      return fail('Connect GitHub Vault first.', 403);
    const client = await getVaultNoteClient(db, { ownerId, sessionVersion }, { readOnly: true });
    const ref = await client.call('/git/ref/heads/' + encodeURIComponent(client.branch));
    if (ref?.object?.sha?.toLowerCase() !== expected.toLowerCase())
      return fail('Your Vault changed since the backup check. Refresh the backup page.', 409);
    const repo = encodeURIComponent(client.vault.githubLogin) + '/' +
      encodeURIComponent(client.vault.repoName);
    return new Response(null, {
      status: 302,
      headers: {
        Location: 'https://github.com/' + repo + '/archive/' + expected.toLowerCase() + '.zip',
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    console.error('Verified Vault snapshot unavailable:', error?.name);
    return fail('Could not verify this GitHub Vault snapshot.', 503);
  }
}
