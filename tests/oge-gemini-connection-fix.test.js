import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  GeminiConnectionError, FREE_GEMINI_MODELS, validateGeminiApiKey,
  testGeminiApiKey,
} from '../lib/oge-gemini-connection.js';

const KEY = 'test-key-not-real-abcdefghijklmnop';
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const models = (...names) => ({ models: names.map((name) => ({
  name: 'models/' + name, supportedGenerationMethods: ['generateContent'],
})) });

test('saving a Gemini key remains independent of model quota and is encrypted', async () => {
  const route = await readFile(new URL('../app/api/gemini-key/route.js', import.meta.url), 'utf8');
  const settings = await readFile(new URL('../app/settings/settings-client.js', import.meta.url), 'utf8');
  assert.match(route, /encryptGeminiKey\(apiKey\)/);
  assert.match(route, /\$set: \{ geminiApiKey: encrypted/);
  assert.doesNotMatch(route, /await validateGeminiApiKey\(apiKey\)/);
  assert.match(route, /action === 'test' && !apiKey/);
  assert.match(route, /apiKey = decryptGeminiKey\(user\.geminiApiKey\)/);
  assert.match(settings, /Test saved key/);
  assert.match(settings, /Replace saved key/);
  assert.match(settings, /!geminiKey\.trim\(\) && !geminiConfigured/);
});

test('Gemini key validation uses the actual Google model listing without generating content', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return json(models('gemini-3.8-flash', 'fake-paid-model', 'gemini-3.5-flash-lite'));
  };
  const result = await validateGeminiApiKey(KEY, { fetcher });
  assert.deepEqual(result.models, ['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/v1beta\/models\?pageSize=100$/);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers['x-goog-api-key'], KEY);
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.ok(FREE_GEMINI_MODELS.includes('gemini-3.5-flash-lite'));
});

test('Gemini smoke test uses listed Flash models, falls back from unavailable model and reports success', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    if (url.includes('pageSize=100')) return json(models('gemini-3.5-flash-lite', 'gemini-3.8-flash'));
    if (url.includes('gemini-3.5-flash-lite')) return json({ error: { status: 'NOT_FOUND' } }, 404);
    return json({ candidates: [{ content: { parts: [{ text: 'connected' }] } }] });
  };
  const result = await testGeminiApiKey(KEY, { fetcher });
  assert.equal(result.model, 'gemini-3.8-flash');
  assert.equal(requests.length, 3);
  assert.equal(requests[1].options.method, 'POST');
  assert.ok(requests[1].options.body.includes('connected'));
});

test('invalid key, quota limit and network failures provide useful safe errors', async () => {
  await assert.rejects(validateGeminiApiKey(KEY, {
    fetcher: async () => json({ error: { message: 'PRIVATE_PROVIDER_DETAIL' } }, 403),
  }), (error) => {
    assert.ok(error instanceof GeminiConnectionError);
    assert.equal(error.status, 403);
    assert.match(error.message, /Google rejected/);
    assert.doesNotMatch(error.message, /PRIVATE_PROVIDER_DETAIL/);
    return true;
  });

  await assert.rejects(testGeminiApiKey(KEY, {
    fetcher: async (url) => url.includes('pageSize') ?
      json(models('gemini-3.5-flash-lite')) :
      json({ error: { message: 'quota exceeded' } }, 429),
  }), (error) => error.status === 429 && /quota or rate limit/.test(error.message));

  await assert.rejects(validateGeminiApiKey(KEY, {
    fetcher: async () => { throw new Error('PRIVATE_PROXY_INFO'); },
  }), (error) => error.status === 503 &&
    /could not reach Google Gemini/i.test(error.message) &&
    !error.message.includes('PRIVATE_PROXY_INFO'));
});

test('model access blocks and unlisted models explain why Test failed without losing a saved key', async () => {
  await assert.rejects(testGeminiApiKey(KEY, {
    fetcher: async (url) => url.includes('pageSize') ?
      json(models('gemini-3.8-flash')) : json({ error: { message: 'private project text' } }, 403),
  }), (error) => error.status === 403 && /denied text generation/.test(error.message));

  await assert.rejects(testGeminiApiKey(KEY, {
    fetcher: async () => json(models('not-a-listed-model')),
  }), (error) => error.status === 409 && /no supported Gemini Flash/.test(error.message));

  await assert.rejects(testGeminiApiKey(KEY, {
    fetcher: async (url) => url.includes('pageSize') ?
      json(models('gemini-3.5-flash-lite')) : json({}, 404),
  }), (error) => error.status === 409 && /unavailable for generation/.test(error.message));
});

test('malformed keys and invalid provider responses are distinguished from unavailable model errors', async () => {
  await assert.rejects(validateGeminiApiKey('short'), (error) =>
    error.status === 400 && /valid-looking/.test(error.message));
  await assert.rejects(validateGeminiApiKey(KEY, { fetcher: async () => json({}) }),
    (error) => error.status === 502 && /invalid model list/.test(error.message));
  const route = await readFile(new URL('../app/api/notes/cleanup/route.js', import.meta.url), 'utf8');
  assert.match(route, /freeModels = FREE_GEMINI_MODELS/);
});
