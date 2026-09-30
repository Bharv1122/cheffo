import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Voice Lab: exercise the real Edge handler with stubbed Supabase and provider
// fetches. No network, credentials, microphone, or database writes.
const lab = await import('../api/_lib/voiceLab.ts');
let cases = 0;

// 1. The hand-written Gemini token body must match what Google's own SDK sends
// for the same constraints, so every field we set is locked server-side.
{
  const { GoogleGenAI, Modality, Type } = await import('@google/genai');
  const instructions = lab.buildVoiceInstructions(null, null);
  let sdkBody = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sdkBody = JSON.parse(init.body);
    return new Response('{"name":"auth_tokens/x"}', { headers: { 'content-type': 'application/json' } });
  };
  const now = Date.parse('2026-10-01T00:00:00Z');
  const ours = lab.geminiTokenRequest('gemini-3.8-live', instructions, now);
  const tools = ours.bidiGenerateContentSetup.tools[0].functionDeclarations.map(fn => ({
    name: fn.name,
    description: fn.description,
    parameters: {
      type: Type.OBJECT,
      properties: Object.fromEntries(Object.entries(fn.parameters.properties).map(([k, v]) => [k, { type: v.type, description: v.description }])),
      required: fn.parameters.required,
    },
  }));
  await new GoogleGenAI({ apiKey: 'k', httpOptions: { apiVersion: 'v1alpha' } }).authTokens.create({ config: {
    uses: 1, expireTime: ours.expireTime, newSessionExpireTime: ours.newSessionExpireTime,
    liveConnectConstraints: { model: 'gemini-3.8-live', config: {
      responseModalities: [Modality.AUDIO], systemInstruction: instructions, tools: [{ functionDeclarations: tools }],
      inputAudioTranscription: {}, outputAudioTranscription: {},
    } },
    lockAdditionalFields: [],
  } });
  globalThis.fetch = realFetch;
  assert.deepEqual(ours, sdkBody, 'Gemini token body matches the official SDK');
  assert.equal(Date.parse(ours.newSessionExpireTime) - now, 60_000, 'token must be used within a minute');
  assert.equal(Date.parse(ours.expireTime) - now, lab.VOICE_SESSION_MAX_SECONDS * 1000, 'session capped');
  assert.equal(ours.uses, 1, 'single use');
  cases += 4;
}

// 2. Pure helpers.
{
  const allowed = lab.parseAllowedEmails(' Owner@Example.com , ,second@example.com');
  assert.equal(allowed.size, 2); cases++;
  assert.equal(lab.isAllowedEmail('owner@example.COM', allowed), true); cases++;
  assert.equal(lab.isAllowedEmail('someone@example.com', allowed), false); cases++;
  assert.equal(lab.isAllowedEmail(undefined, allowed), false); cases++;
  assert.equal(lab.parseAllowedEmails(undefined).size, 0); cases++;

  const recipe = lab.toVoiceRecipe('Turkey Bowl', {
    ingredients: [{ name: 'Ground turkey', amountGrams: 453.6, groceryFriendlyAmount: '1 lb' }, { name: 'Rice', amountGrams: 150 }, { bogus: true }],
    instructions: [{ stepNumber: 1, instruction: 'Brown the turkey.', durationMinutes: 10 }, { instruction: 'Cool.' }, 'junk'],
    safetyNotes: ['Cook to 165°F'],
  });
  assert.deepEqual(recipe.ingredients, [{ name: 'Ground turkey', amount: '1 lb' }, { name: 'Rice', amount: '150 g' }]); cases++;
  assert.deepEqual(recipe.steps.map(s => s.stepNumber), [1, 2]); cases++;
  assert.equal(lab.toVoiceRecipe('x', null), null); cases++;

  const dog = lab.toVoiceDog({ name: 'Cooper', weight_lbs: 42, allergies: ['chicken'], avoid_foods: [], medications: ['warfarin'] });
  const text = lab.buildVoiceInstructions(recipe, dog);
  for (const needle of ['Cooper', '42 lbs', 'chicken', 'warfarin', 'Turkey Bowl', '1. Brown the turkey. (about 10 min)', 'grapes', '888-426-4435', 'reference data only']) {
    assert.ok(text.includes(needle), `instructions include ${needle}`); cases++;
  }
  const huge = lab.toVoiceRecipe('Big', { instructions: Array.from({ length: 30 }, (_, i) => ({ stepNumber: i + 1, instruction: 'x'.repeat(400) })) });
  assert.ok(lab.buildVoiceInstructions(huge, null).length < 12000, 'recipe context is capped'); cases++;

  const openai = lab.openAiSecretRequest('gpt-realtime-2.1-mini', text, 'gpt-4o-mini-transcribe');
  assert.equal(openai.session.type, 'realtime'); cases++;
  assert.equal(openai.session.instructions, text); cases++;
  assert.deepEqual(openai.session.tools.map(t => t.name), ['set_timer', 'go_to_step']); cases++;
  assert.equal(openai.expires_after.seconds, 60); cases++;
}

// 3. The handler.
const stub = `
export function getUserClient() { return {
  auth: {getUser: async () => globalThis.__voiceTest.auth},
  from(table) { return {select() { return {eq() { return {async maybeSingle() {
    return {data: table === 'saved_recipes' ? globalThis.__voiceTest.recipe : globalThis.__voiceTest.dog, error: null};
  }}}}}}; },
}; }
export function getSupabaseAdmin() { return { async rpc() { globalThis.__voiceTest.quotaCalls++; return globalThis.__voiceTest.quota; } }; }
`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '../_lib/supabaseAdmin' && context.parentURL?.endsWith('/api/voice/session.ts'))
    return { url: 'data:text/javascript,' + encodeURIComponent(stub), shortCircuit: true };
  if (specifier === '../_lib/voiceLab' && context.parentURL?.endsWith('/api/voice/session.ts'))
    return { url: new URL('../api/_lib/voiceLab.ts', import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { default: handler } = await import('../api/voice/session.ts');

const RECIPE_ID = '11111111-2222-3333-4444-555555555555';
let upstream = [];
globalThis.fetch = async (url, init) => {
  upstream.push({ url: String(url), init });
  if (globalThis.__voiceTest.upstreamStatus !== 200) {
    return new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: globalThis.__voiceTest.upstreamStatus });
  }
  return new Response(JSON.stringify(String(url).includes('openai') ? { value: 'ek_test' } : { name: 'auth_tokens/test' }));
};

async function check(name, { env = {}, test = {}, body = { provider: 'gemini' }, auth = true, method = 'POST' }, expectedStatus) {
  for (const key of ['VOICE_LAB_ALLOWED_EMAILS', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'LLM_API_KEY', 'LLM_BASE_URL']) delete process.env[key];
  Object.assign(process.env, { VOICE_LAB_ALLOWED_EMAILS: 'owner@example.com', GEMINI_API_KEY: 'g-test', OPENAI_API_KEY: 'o-test', ...env });
  for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
  globalThis.__voiceTest = {
    auth: { data: { user: { id: 'u1', email: 'Owner@example.com' } }, error: null },
    recipe: { name: 'Turkey Bowl', recipe_data: { ingredients: [], instructions: [{ stepNumber: 1, instruction: 'Cook.' }] }, dog_profile_id: 'd1' },
    dog: { name: 'Cooper', weight_lbs: 40, allergies: [], avoid_foods: [], medications: [] },
    quota: { data: [{ allowed: true }], error: null }, quotaCalls: 0, upstreamStatus: 200,
    ...test,
  };
  upstream = [];
  const response = await handler(new Request('https://app.invalid/api/voice/session', {
    method, headers: auth ? { authorization: 'Bearer user-token' } : {}, body: method === 'POST' ? JSON.stringify(body) : undefined,
  }));
  assert.equal(response.status, expectedStatus, name);
  cases++;
  return { response, json: await response.json().catch(() => null) };
}

await check('GET rejected', { method: 'GET' }, 405);
{
  const r = await check('lab off without allowlist', { env: { VOICE_LAB_ALLOWED_EMAILS: undefined } }, 404);
  assert.equal(upstream.length, 0); cases++;
  assert.equal(r.json.error, 'Not found'); cases++;
}
await check('signed out', { auth: false }, 401);
await check('expired session', { test: { auth: { data: { user: null }, error: { message: 'bad' } } } }, 401);
{
  await check('other account looks like 404', { test: { auth: { data: { user: { id: 'u2', email: 'someone@example.com' } }, error: null } } }, 404);
  assert.equal(globalThis.__voiceTest.quotaCalls, 0, 'non-owner spends nothing'); cases++;
}
await check('bad provider', { body: { provider: 'other' } }, 400);
await check('missing recipe', { body: { provider: 'gemini', recipeId: RECIPE_ID }, test: { recipe: null } }, 404);
{
  await check('daily limit', { test: { quota: { data: [{ allowed: false }], error: null } } }, 429);
  assert.equal(upstream.length, 0, 'no provider call over limit'); cases++;
}
await check('quota outage fails closed', { test: { quota: { data: null, error: { message: 'down' } } } }, 503);

{
  const { json } = await check('gemini grant', { body: { provider: 'gemini', recipeId: RECIPE_ID } }, 200);
  assert.equal(json.token, 'auth_tokens/test'); cases++;
  assert.equal(json.recipeLoaded, true); cases++;
  assert.equal(upstream[0].url, 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens'); cases++;
  assert.equal(upstream[0].init.headers['x-goog-api-key'], 'g-test'); cases++;
  assert.equal(upstream[0].init.redirect, 'error'); cases++;
  const sent = JSON.parse(upstream[0].init.body);
  assert.ok(sent.bidiGenerateContentSetup.systemInstruction.parts[0].text.includes('Cooper'), 'dog context sent'); cases++;
  assert.equal(sent.bidiGenerateContentSetup.model, 'models/gemini-3.8-live'); cases++;
}
{
  await check('gemini falls back to the Google LLM key', { env: { GEMINI_API_KEY: undefined, LLM_API_KEY: 'llm-key', LLM_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai' } }, 200);
  assert.equal(upstream[0].init.headers['x-goog-api-key'], 'llm-key'); cases++;
}
await check('no fallback to a non-Google key', { env: { GEMINI_API_KEY: undefined, LLM_API_KEY: 'other', LLM_BASE_URL: 'https://example.invalid' } }, 500);
{
  const { json } = await check('openai grant', { body: { provider: 'openai' } }, 200);
  assert.equal(json.token, 'ek_test'); cases++;
  assert.equal(upstream[0].url, 'https://api.openai.com/v1/realtime/client_secrets'); cases++;
  assert.equal(upstream[0].init.headers.Authorization, 'Bearer o-test'); cases++;
  assert.equal(JSON.parse(upstream[0].init.body).session.model, 'gpt-realtime-2.1-mini'); cases++;
}
await check('openai not configured', { env: { OPENAI_API_KEY: undefined }, body: { provider: 'openai' } }, 500);
{
  const { json } = await check('provider error surfaced without secrets', { test: { upstreamStatus: 400 } }, 502);
  assert.match(json.error, /400: model not found/); cases++;
  assert.ok(!JSON.stringify(json).includes('g-test'), 'key never echoed'); cases++;
}
{
  const { json } = await check('invalid recipe id ignored', { body: { provider: 'gemini', recipeId: "x' or 1=1" } }, 200);
  assert.equal(json.recipeLoaded, false); cases++;
}

console.log(`Voice Lab verified: ${cases} checks (SDK-matched Gemini token body, allowlist, quota, providers). No network or real credentials used.`);
