// Google's Gemini key verification and optional generation smoke test.
// The key remains server-side and provider error bodies are never returned.
const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com/v1beta';
export const FREE_GEMINI_MODELS = [
  'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash',
];

export class GeminiConnectionError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'GeminiConnectionError';
    this.status = status;
  }
}

function providerError(status, phase) {
  if ([401, 403].includes(status)) {
    return phase === 'test'
      ? new GeminiConnectionError('Gemini denied text generation (HTTP ' + status +
          '). Your key may be valid but the Google AI Studio project is not allowed to use this model or free tier.', 403)
      : new GeminiConnectionError('Google rejected this API key or its API restrictions (HTTP ' +
          status + '). Check the project and restrictions in Google AI Studio.', 403);
  }
  if (status === 429) return new GeminiConnectionError(
    'Gemini quota or rate limit reached (HTTP 429). Check your project quota in Google AI Studio and retry later.', 429);
  if ([500, 502, 503, 504].includes(status)) return new GeminiConnectionError(
    'Google Gemini is temporarily unavailable (HTTP ' + status + '). Try again later.', 503);
  if (status === 400) return new GeminiConnectionError(
    'Gemini rejected the ' + (phase === 'test' ? 'generation request' : 'key verification') +
    ' (HTTP 400). Check Gemini API access and model support for this project.', 400);
  return new GeminiConnectionError('Gemini ' + phase +
    ' failed (HTTP ' + status + '). Check the Google AI Studio project.', 502);
}

async function apiRequest(path, key, { fetcher = fetch, method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetcher(GEMINI_ORIGIN + path, {
      method, cache: 'no-store', signal: AbortSignal.timeout(12000),
      headers: { 'x-goog-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new GeminiConnectionError(
      'OgeV2 could not reach Google Gemini. Check the server network connection and try again.', 503);
  }
  // Do not render or log Google's raw error body: it may contain project data.
  const data = response.ok ? await response.json().catch(() => ({})) : {};
  return { status: response.status, ok: response.ok, data };
}

export async function validateGeminiApiKey(key, { fetcher = fetch } = {}) {
  if (typeof key !== 'string' || key.length < 10 || key.length > 512 || /\s/.test(key))
    throw new GeminiConnectionError('Enter a valid-looking Google Gemini API key.', 400);
  const result = await apiRequest('/models?pageSize=100', key, { fetcher });
  if (!result.ok) throw providerError(result.status, 'verification');
  if (!Array.isArray(result.data.models))
    throw new GeminiConnectionError('Gemini returned an invalid model list. Try again later.', 502);
  // Model IDs are only taken from our explicit supported set; never select
  // an arbitrary paid or image model from the provider response.
  const available = new Set(result.data.models
    .filter((model) => Array.isArray(model?.supportedGenerationMethods) &&
      model.supportedGenerationMethods.includes('generateContent'))
    .map((model) => model?.name));
  return { models: FREE_GEMINI_MODELS.filter((id) => available.has('models/' + id)) };
}

export async function testGeminiApiKey(key, { fetcher = fetch } = {}) {
  const { models } = await validateGeminiApiKey(key, { fetcher });
  if (!models.length)
    throw new GeminiConnectionError('The API key was accepted, but no supported Gemini Flash text model is listed for this project. Check model access in Google AI Studio.', 409);
  let unavailable = false, quota = false, lastError = null;
  for (const model of models) {
    const result = await apiRequest('/models/' + model + ':generateContent', key, {
      fetcher, method: 'POST', body: {
        contents: [{ role: 'user', parts: [{ text: 'Reply with the word: connected' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 64 },
      },
    });
    if (!result.ok) {
      if (result.status === 404) { unavailable = true; continue; }
      if (result.status === 429) { quota = true; continue; }
      if (result.status >= 500) { lastError = providerError(result.status, 'test'); continue; }
      throw providerError(result.status, 'test');
    }
    const text = result.data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '').join('').trim();
    if (text) return { model };
    lastError = new GeminiConnectionError(
      'Gemini accepted the key, but the model returned no test text. Try again later.', 502);
  }
  if (quota) throw providerError(429, 'test');
  if (lastError) throw lastError;
  if (unavailable) throw new GeminiConnectionError(
    'This key was accepted, but the listed Gemini Flash models are unavailable for generation (HTTP 404). Check model access in Google AI Studio.', 409);
  throw new GeminiConnectionError('No Gemini Flash model completed the connection test.', 502);
}
