// Voice Lab session broker (owner-only prototype).
//
// POST { provider: 'gemini' | 'openai', recipeId?: string }
// Returns a single-use, short-lived provider credential whose model,
// instructions and tools are locked server-side (see api/_lib/voiceLab.ts).
// The long-lived provider keys never leave the server.
//
// Access: a signed-in user whose email is listed in VOICE_LAB_ALLOWED_EMAILS.
// With that variable unset the endpoint answers 404, so the lab is off by
// default. Each session start also counts against the user's daily AI limit.
//
// Env: VOICE_LAB_ALLOWED_EMAILS, GEMINI_API_KEY (falls back to LLM_API_KEY when
// LLM_BASE_URL is Google's), OPENAI_API_KEY, optional VOICE_GEMINI_MODEL,
// VOICE_OPENAI_MODEL, VOICE_OPENAI_TRANSCRIBE_MODEL.

import { getSupabaseAdmin, getUserClient } from '../_lib/supabaseAdmin';
import {
  buildVoiceInstructions,
  geminiTokenRequest,
  isAllowedEmail,
  openAiSecretRequest,
  parseAllowedEmails,
  toVoiceDog,
  toVoiceRecipe,
  VOICE_SESSION_MAX_SECONDS,
  type VoiceProvider,
} from '../_lib/voiceLab';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_DAILY_LIMIT = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function geminiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const base = new URL(process.env.LLM_BASE_URL ?? '');
    if (base.hostname === 'generativelanguage.googleapis.com') return process.env.LLM_API_KEY;
  } catch { /* not configured */ }
  return undefined;
}

// Owner-only lab: surface the provider's own error text (trimmed) so setup
// problems such as a wrong model name are diagnosable. Never echo credentials.
async function providerError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
  const message = typeof body?.error?.message === 'string' ? body.error.message : '';
  return `Provider returned ${response.status}${message ? `: ${message.slice(0, 300)}` : ''}`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const allowed = parseAllowedEmails(process.env.VOICE_LAB_ALLOWED_EMAILS);
  if (allowed.size === 0) return json(404, { error: 'Not found' });

  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) return json(401, { error: 'Sign in to use the Voice Lab.' });

  let userId: string;
  let userClient: ReturnType<typeof getUserClient>;
  try {
    userClient = getUserClient(accessToken);
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return json(401, { error: 'Your session has expired. Please sign in again.' });
    if (!isAllowedEmail(data.user.email, allowed)) return json(404, { error: 'Not found' });
    userId = data.user.id;
  } catch {
    return json(401, { error: 'Could not verify your session.' });
  }

  const body = await req.json().catch(() => null) as { provider?: unknown; recipeId?: unknown } | null;
  const provider = body?.provider;
  if (provider !== 'gemini' && provider !== 'openai') return json(400, { error: 'Choose a provider.' });
  const recipeId = typeof body?.recipeId === 'string' && UUID_RE.test(body.recipeId) ? body.recipeId : null;

  // Recipe and dog are read through the user's own RLS-scoped client.
  let recipe = null;
  let dog = null;
  if (recipeId) {
    const { data: row } = await userClient
      .from('saved_recipes')
      .select('name, recipe_data, dog_profile_id')
      .eq('id', recipeId)
      .maybeSingle();
    if (!row) return json(404, { error: 'Recipe not found.' });
    recipe = toVoiceRecipe(row.name, row.recipe_data);
    const { data: dogRow } = await userClient
      .from('dog_profiles')
      .select('name, weight_lbs, allergies, avoid_foods, medications')
      .eq('id', row.dog_profile_id)
      .maybeSingle();
    dog = toVoiceDog(dogRow as Record<string, unknown> | null);
  }

  const dailyLimit = Number(process.env.LLM_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  try {
    const { data, error } = await getSupabaseAdmin().rpc('check_and_increment_llm_usage', {
      p_user_id: userId,
      p_daily_limit: dailyLimit,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row || typeof row.allowed !== 'boolean') return json(503, { error: 'AI usage limits are temporarily unavailable.' });
    if (!row.allowed) return json(429, { error: `Daily AI limit reached (${dailyLimit}).` });
  } catch {
    return json(503, { error: 'AI usage limits are temporarily unavailable.' });
  }

  const instructions = buildVoiceInstructions(recipe, dog);
  const selected: VoiceProvider = provider;

  if (selected === 'gemini') {
    const key = geminiKey();
    if (!key) return json(500, { error: 'Gemini is not configured (GEMINI_API_KEY).' });
    const model = process.env.VOICE_GEMINI_MODEL || 'gemini-3.8-live';
    const response = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(geminiTokenRequest(model, instructions, Date.now())),
    }).catch(() => null);
    if (!response) return json(502, { error: 'Could not reach Gemini.' });
    if (!response.ok) return json(502, { error: await providerError(response) });
    const token = await response.json().catch(() => null) as { name?: unknown } | null;
    if (typeof token?.name !== 'string' || !token.name.startsWith('auth_tokens/')) {
      return json(502, { error: 'Gemini returned an unexpected token.' });
    }
    return json(200, { provider: 'gemini', model, token: token.name, maxSeconds: VOICE_SESSION_MAX_SECONDS, recipeLoaded: Boolean(recipe) });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) return json(500, { error: 'OpenAI is not configured (OPENAI_API_KEY).' });
  const model = process.env.VOICE_OPENAI_MODEL || 'gpt-realtime-2.1-mini';
  const transcribeModel = process.env.VOICE_OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(openAiSecretRequest(model, instructions, transcribeModel)),
  }).catch(() => null);
  if (!response) return json(502, { error: 'Could not reach OpenAI.' });
  if (!response.ok) return json(502, { error: await providerError(response) });
  const secret = await response.json().catch(() => null) as { value?: unknown } | null;
  if (typeof secret?.value !== 'string') return json(502, { error: 'OpenAI returned an unexpected token.' });
  return json(200, { provider: 'openai', model, token: secret.value, maxSeconds: VOICE_SESSION_MAX_SECONDS, recipeLoaded: Boolean(recipe) });
}
