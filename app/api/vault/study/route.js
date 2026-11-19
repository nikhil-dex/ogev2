import { auth } from '../../../../auth.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { ownerMutationFilter } from '../../../../lib/active-owner-mutation.js';
import { connectedVaultStorageAvailable } from '../../../../lib/oge-vault-workspace-routing.js';
import { getVaultNoteClient, listVaultNotePage, readVaultNote } from '../../../../lib/oge-vault-notes.js';
import { annotateVaultStudyPage, recordVaultReview } from '../../../../lib/oge-vault-study.js';
import { readLimitedBody } from '../../../../lib/read-limited-body.js';
import { VaultGitHubError } from '../../../../lib/oge-vault-github.js';
import { checkOwnerMutationLimit, rateLimitResponse } from '../../../../lib/rate-limit.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (v, status = 200) => Response.json(v, {
  status, headers: { 'Cache-Control': 'private, no-store' },
});
async function context() {
  const session = await auth();
  if (!session?.user?.id) return { response: json({ error: 'Sign in to study.' }, 401) };
  const db = await getDatabase();
  const ownerId = session.user.id, sessionVersion = session.user.sessionVersion;
  const account = await db.collection('users').findOne(
    ownerMutationFilter(ownerId, { sessionVersion }),
    { projection: { notesStorage: 1, vault: 1 } },
  );
  if (account?.notesStorage !== 'github' || !connectedVaultStorageAvailable(account))
    return { response: json({ error: 'Connect GitHub Vault to study.' }, 403) };
  if (process.env.OGE_VAULT_MAIN_PREVIEW !== 'true')
    return { response: json({ error: 'GitHub Notes are not enabled.' }, 404) };
  const client = await getVaultNoteClient(db, { ownerId, sessionVersion }, { readOnly: true });
  return { db, client, ownerId };
}
function failed(error) {
  if (error instanceof SyntaxError || error instanceof TypeError)
    return json({ error: 'Invalid study request.' }, 400);
  if (error instanceof VaultGitHubError)
    return json({ error: 'Could not verify your Vault note.' },
      [401, 403, 404, 409, 429].includes(error.status) ? error.status : 503);
  console.error('GitHub study failure:', error?.name);
  return json({ error: 'Could not load or save your study progress.' }, 503);
}
export async function GET(request) {
  try {
    const ctx = await context();
    if (ctx.response) return ctx.response;
    const params = new URL(request.url).searchParams;
    const cursor = params.get('cursor');
    const page = await listVaultNotePage(ctx.client, { limit: 20, cursor });
    return json({
      notes: await annotateVaultStudyPage(ctx.db, ctx.client, ctx.ownerId, page.notes),
      nextCursor: page.nextCursor, total: page.total,
    });
  } catch (error) { return failed(error); }
}
export async function POST(request) {
  try {
    const ctx = await context();
    if (ctx.response) return ctx.response;
    const throttle = await checkOwnerMutationLimit(ctx.db, ctx.ownerId, 'notes');
    if (!throttle.allowed) return rateLimitResponse(throttle);
    const body = JSON.parse(await readLimitedBody(request, 2048));
    if (typeof body?.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.id) ||
        !['again', 'hard', 'good', 'easy'].includes(body.rating))
      return json({ error: 'Select a valid note and recall rating.' }, 400);
    const note = await readVaultNote(ctx.client, body.id.toLowerCase());
    const subject = await ctx.db.collection('subjects').findOne({
      ownerId: ctx.ownerId, slug: note.subjectId,
    }, { projection: { _id: 1 } });
    if (!subject) return json({ error: 'Note subject is unavailable.' }, 404);
    return json(await recordVaultReview(ctx.db, ctx.client, ctx.ownerId, note, body.rating));
  } catch (error) { return failed(error); }
}
