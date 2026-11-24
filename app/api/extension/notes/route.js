import { ObjectId } from 'mongodb';
import { hashExtensionToken } from '../../../../lib/extension-token.js';
import { getDatabase } from '../../../../lib/mongodb.js';
import { readLimitedBody } from '../../../../lib/read-limited-body.js';
import { checkRateLimit, rateLimitResponse } from '../../../../lib/rate-limit.js';
import { inspectLegacyCutoverForOwner, legacyCutoverBlockedResponse } from '../../../../lib/oge-vault-cutover-guard.js';
import { withActiveOwnerMutation } from '../../../../lib/active-owner-mutation.js';
import { vaultCaptureAvailable } from '../../../../lib/oge-vault-workspace-routing.js';
import { getVaultNoteClient, listVaultNotePage, readVaultNote } from '../../../../lib/oge-vault-notes.js';
import { commitVaultNoteBatch } from '../../../../lib/oge-vault-batch.js';
import { withVaultSubjectWrite, VaultSubjectLockedError } from '../../../../lib/oge-vault-subject-fence.js';
import { VaultGitHubError } from '../../../../lib/oge-vault-github.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const TOKEN = /^oge_[A-Za-z0-9_-]{40,60}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{40}$/i;
const HEADERS = {
  'Cache-Control': 'private, no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Vary': 'Origin',
};
const json = (data, status = 200) => Response.json(data, { status, headers: HEADERS });
export const OPTIONS = () => new Response(null, { status: 204, headers: HEADERS });

async function ownerFor(request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!TOKEN.test(token)) return null;
  const db = await getDatabase();
  const tokenHash = hashExtensionToken(token);
  const owner = await db.collection('users').findOne({
    extensionTokenHash: tokenHash, extensionTokenExpiresAt: { $gt: new Date() },
  }, { projection: { googleSub: 1, sessionVersion: 1, notesStorage: 1, vault: 1 } });
  return owner?.googleSub ? { db, tokenHash, owner } : null;
}
async function subjectFor(ctx, slug) {
  if (!UUID.test(slug || '')) return null;
  return ctx.db.collection('subjects').findOne({
    ownerId: ctx.owner.googleSub, slug,
  }, { projection: { name: 1 } });
}
const latestFirst = (a, b) => String(b.updatedAt || b.createdAt || '')
  .localeCompare(String(a.updatedAt || a.createdAt || ''));

// The tree paginator avoids the historical 500-note directory limit.
// Snapshot changes during enumeration produce a conflict, not a misleading list.
async function vaultSubjectNotes(client, subject) {
  let cursor = null;
  const collected = [];
  do {
    const page = await listVaultNotePage(client, { cursor, limit: 25 });
    collected.push(...page.notes.filter((note) => note.subjectId === subject));
    cursor = page.nextCursor;
  } while (cursor);
  return collected.sort(latestFirst);
}

export async function GET(request) {
  try {
    const ctx = await ownerFor(request);
    if (!ctx) return json({ error: 'Reconnect the Oge extension to list Notes.' }, 401);
    const limit = await checkRateLimit(ctx.db, { scope: 'extension-note-picker',
      identifier: ctx.tokenHash, limit: 120, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return rateLimitResponse(limit);
    const params = new URL(request.url).searchParams;
    const subject = params.get('subject') || '';
    const offset = Number(params.get('offset') || '0');
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000 || !await subjectFor(ctx, subject))
      return json({ error: 'Select a valid subject.' }, 400);
    let notes;
    if (vaultCaptureAvailable(ctx.owner)) {
      const client = await getVaultNoteClient(ctx.db, {
        ownerId: ctx.owner.googleSub, sessionVersion: ctx.owner.sessionVersion ?? 0,
      });
      notes = await vaultSubjectNotes(client, subject);
    } else {
      const cutover = await inspectLegacyCutoverForOwner(ctx.db, ctx.owner.googleSub,
        { extensionTokenHash: ctx.tokenHash });
      if (cutover.blocked) return legacyCutoverBlockedResponse(cutover, { headers: HEADERS });
      notes = await ctx.db.collection('notes').find({ ownerId: ctx.owner.googleSub, subjectSlug: subject },
        { projection: { _id: 1, heading: 1, updatedAt: 1, createdAt: 1 } })
        .sort({ updatedAt: -1, createdAt: -1 }).skip(offset).limit(6).toArray();
      return json({ notes: notes.slice(0, 5).map((note) => ({
        id: String(note._id), heading: note.heading,
        version: new Date(note.updatedAt || note.createdAt).toISOString(),
      })), hasMore: notes.length > 5 });
    }
    const slice = notes.slice(offset, offset + 6);
    return json({ notes: slice.slice(0, 5).map((note) => ({
      id: note.id, heading: note.heading, version: note.sha,
    })), hasMore: slice.length > 5 });
  } catch (error) {
    if (error instanceof VaultGitHubError)
      return json({ error: 'Could not read GitHub Notes. Reopen the selector and retry.' }, 503);
    console.error('Extension Note picker failed:', error?.name);
    return json({ error: 'Could not load notes for this subject.' }, 503);
  }
}

export async function POST(request) {
  let data;
  try { data = JSON.parse(await readLimitedBody(request, 32 * 1024)); }
  catch (error) { return json({ error: error?.status === 413 ? 'Note is too large.' : 'Enter valid JSON.' }, error?.status || 400); }
  const content = typeof data?.content === 'string' ? data.content.trim() : '';
  const subject = data?.subjectSlug;
  const noteId = data?.noteId;
  const version = data?.version;
  if (!content || content.length > 20000 || !UUID.test(subject || '') ||
      typeof noteId !== 'string' || typeof version !== 'string')
    return json({ error: 'Select a Note and enter up to 20,000 characters.' }, 400);
  try {
    const ctx = await ownerFor(request);
    if (!ctx) return json({ error: 'Reconnect the extension before appending.' }, 401);
    const throttle = await checkRateLimit(ctx.db, {
      scope: 'extension-note-append', identifier: ctx.tokenHash, limit: 40, windowMs: 60 * 60 * 1000,
    });
    if (!throttle.allowed) return rateLimitResponse(throttle);
    const selectedSubject = await subjectFor(ctx, subject);
    if (!selectedSubject) return json({ error: 'Subject no longer exists. Refresh the list.' }, 404);
    if (vaultCaptureAvailable(ctx.owner)) {
      if (!UUID.test(noteId) || !SHA.test(version))
        return json({ error: 'Select an existing GitHub Note.' }, 400);
      const client = await getVaultNoteClient(ctx.db, {
        ownerId: ctx.owner.googleSub, sessionVersion: ctx.owner.sessionVersion ?? 0,
      });
      const previous = await readVaultNote(client, noteId);
      if (previous.subjectId !== subject)
        return json({ error: 'This Note belongs to another subject.' }, 409);
      if (previous.sha !== version)
        return json({ error: 'This Note changed. Refresh the list before appending.' }, 409);
      const answer = previous.answer + '\n\n' + content;
      if (answer.length > 20000) return json({ error: 'The Note would exceed 20,000 characters.' }, 400);
      const saved = await withVaultSubjectWrite(ctx.db, ctx.owner.googleSub, subject, () =>
        commitVaultNoteBatch(client, [{ action: 'update', id: previous.id, sha: previous.sha,
          note: { subjectId: subject, heading: previous.heading, answer,
            tags: previous.tags, favorite: previous.favorite, pinned: previous.pinned === true } }]));
      return json({ id: saved.results[0].id, title: saved.results[0].heading,
        version: saved.results[0].sha, subject: selectedSubject.name, confirmed: true });
    }
    if (!ObjectId.isValid(noteId) || !Number.isFinite(Date.parse(version)))
      return json({ error: 'Select an existing Note.' }, 400);
    return await withActiveOwnerMutation(ctx.db, ctx.owner.googleSub, async (session) => {
      const live = await ctx.db.collection('users').findOne({
        googleSub: ctx.owner.googleSub, extensionTokenHash: ctx.tokenHash,
        extensionTokenExpiresAt: { $gt: new Date() },
      }, { session, projection: { _id: 1 } });
      if (!live) return json({ error: 'Extension session expired.' }, 401);
      const cutover = await inspectLegacyCutoverForOwner(ctx.db, ctx.owner.googleSub,
        { extensionTokenHash: ctx.tokenHash }, { session });
      if (cutover.blocked) return legacyCutoverBlockedResponse(cutover, { headers: HEADERS });
      const collection = ctx.db.collection('notes');
      const previous = await collection.findOne({
        _id: new ObjectId(noteId), ownerId: ctx.owner.googleSub, subjectSlug: subject,
      }, { session });
      if (!previous) return json({ error: 'Note not found in this subject.' }, 404);
      if (new Date(previous.updatedAt || previous.createdAt).toISOString() !== version)
        return json({ error: 'This Note changed. Refresh the list before appending.' }, 409);
      const answer = previous.answer + '\n\n' + content;
      if (answer.length > 20000) return json({ error: 'The Note would exceed 20,000 characters.' }, 400);
      const updatedAt = new Date();
      const updated = await collection.updateOne({
        _id: previous._id, ownerId: ctx.owner.googleSub, subjectSlug: subject,
        updatedAt: previous.updatedAt,
      }, { $set: { answer, updatedAt },
        $push: { revisions: { $each: [{ heading: previous.heading, answer: previous.answer,
          savedAt: previous.updatedAt || previous.createdAt }], $slice: -20 } } }, { session });
      if (updated.matchedCount !== 1)
        return json({ error: 'This Note changed. Refresh before appending.' }, 409);
      return json({ id: noteId, title: previous.heading, subject: selectedSubject.name,
        version: updatedAt.toISOString(), confirmed: true });
    }, { sessionVersion: ctx.owner.sessionVersion ?? 0 });
  } catch (error) {
    if (error instanceof VaultSubjectLockedError) return json({ error: error.message }, 409);
    if (error instanceof VaultGitHubError)
      return json({ error: 'GitHub Note changed or could not be saved. Refresh before retrying.' }, 409);
    console.error('Extension Note append failed:', error?.name);
    return json({ error: 'Could not confirm append. Refresh before retrying to avoid duplicate text.' }, 503);
  }
}
