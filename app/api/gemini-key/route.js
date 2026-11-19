import { auth } from '../../../auth.js';
import { getDatabase } from '../../../lib/mongodb.js';
import { readLimitedBody } from '../../../lib/read-limited-body.js';
import { encryptGeminiKey, decryptGeminiKey, maskGeminiKey } from '../../../lib/gemini-key.js';
import { GeminiConnectionError, validateGeminiApiKey, testGeminiApiKey } from '../../../lib/oge-gemini-connection.js';
import { checkRateLimit, rateLimitResponse } from '../../../lib/rate-limit.js';
import { ownerMutationFilter } from '../../../lib/active-owner-mutation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function context() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { db: await getDatabase(), ownerId: session.user.id, sessionVersion: session.user.sessionVersion };
}

async function readBody(request) {
  try {
    return JSON.parse(await readLimitedBody(request, 8 * 1024));
  } catch (error) {
    throw new Error(error?.status === 413 ? 'Request body is too large.' : 'Enter valid JSON.');
  }
}

export async function GET() {
  try {
    const ctx = await context();
    if (!ctx) return json({ error: 'Sign in to manage your Gemini API key.' }, 401);
    const accountFilter = ownerMutationFilter(ctx.ownerId, { sessionVersion: ctx.sessionVersion });
    const user = await ctx.db.collection('users').findOne(
      accountFilter,
      { projection: { geminiApiKey: 1 } },
    );
    if (!user) return json({ error: 'Your account session has changed. Sign in again.' }, 401);
    const stored = user.geminiApiKey;
    return json({
      configured: Boolean(stored?.ciphertext && stored?.iv && stored?.tag),
      updatedAt: stored?.updatedAt || null,
    });
  } catch (error) {
    console.error('GET /api/gemini-key failed:', error?.name);
    return json({ error: 'Could not load Gemini key status.' }, 500);
  }
}

export async function POST(request) {
  let ctx;
  try {
    ctx = await context();
    if (!ctx) return json({ error: 'Sign in to manage your Gemini API key.' }, 401);
    const throttle = await checkRateLimit(ctx.db, { scope: 'gemini-key-update', identifier: ctx.ownerId, limit: 12, windowMs: 60 * 60 * 1000 });
    if (!throttle.allowed) return rateLimitResponse(throttle);
    const data = await readBody(request);
    const action = String(data?.action || '');
    if (!['save', 'test', 'delete'].includes(action)) {
      return json({ error: 'Choose save, test, or delete.' }, 400);
    }
    const users = ctx.db.collection('users');
    const accountFilter = ownerMutationFilter(ctx.ownerId, { sessionVersion: ctx.sessionVersion });

    if (action === 'delete') {
      const result = await users.updateOne(accountFilter, { $unset: { geminiApiKey: '' } });
      if (result.matchedCount !== 1) return json({ error: 'Your account is no longer available. Sign in again.' }, 401);
      return json({ configured: false, message: 'Gemini API key removed.' });
    }

    let apiKey = String(data?.apiKey || '').trim();
    if (action === 'test' && !apiKey) {
      const user = await users.findOne(accountFilter, { projection: { geminiApiKey: 1 } });
      if (!user) return json({ error: 'Your account session has changed. Sign in again.' }, 401);
      if (!user.geminiApiKey?.ciphertext)
        return json({ error: 'Paste a Gemini API key or save one first.' }, 400);
      try {
        apiKey = decryptGeminiKey(user.geminiApiKey);
      } catch {
        return json({ error: 'Could not unlock your saved Gemini key. Re-enter it in Settings.' }, 503);
      }
    }
    if (action === 'test') {
      const result = await testGeminiApiKey(apiKey);
      return json({ valid: true, model: result.model,
        message: 'Gemini connection successful (' + result.model + ').' });
    }

    // Saving a valid key does not depend on the current model quota. A
    // generation failure belongs to Test only, not credential persistence.
    const availability = await validateGeminiApiKey(apiKey);
    const encrypted = encryptGeminiKey(apiKey);
    const result = await users.updateOne(accountFilter, { $set: { geminiApiKey: encrypted, updatedAt: new Date() } });
    if (result.matchedCount !== 1) return json({ error: 'Your account is no longer available. Sign in again.' }, 401);
    const note = availability.models.length
      ? ' Select Test connection to check generation access.'
      : ' The key is valid, but no supported Gemini Flash text model is currently listed for your project.';
    return json({ configured: true, updatedAt: encrypted.updatedAt,
      maskedKey: maskGeminiKey(apiKey), message: 'Gemini API key saved.' + note });
  } catch (error) {
    if (error?.message === 'GEMINI_KEY_ENCRYPTION_SECRET must be configured with at least 32 characters.') {
      return json({ error: 'Gemini BYOK is not configured on this deployment yet. Set GEMINI_KEY_ENCRYPTION_SECRET on the server.' }, 503);
    }
    if (error instanceof GeminiConnectionError)
      return json({ error: error.message }, error.status);
    if (error?.message?.startsWith('Request body'))
      return json({ error: error.message }, 400);
    console.error('POST /api/gemini-key failed:', error?.name);
    return json({ error: 'Could not update Gemini API key.' }, 500);
  }
}
