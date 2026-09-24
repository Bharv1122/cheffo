import { getSupabaseAdmin, getUserClient } from './_lib/supabaseAdmin';
import type { Json } from '../src/types/database';

export const config = { runtime: 'edge' };
const MAX_BODY_BYTES = 128 * 1024;
const encoder = new TextEncoder();
const reasons = new Set(['unsafe', 'offensive', 'incorrect', 'other']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function readBody(req: Request): Promise<unknown> {
  const length = req.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new RangeError();
  const reader = req.body?.getReader();
  if (!reader) throw new SyntaxError();
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

function record(value: unknown): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined> : {};
}

function bounded(value: Json | undefined, limit = 32 * 1024): Json {
  if (value === undefined) return null;
  const byteLength = encoder.encode(JSON.stringify(value)).byteLength;
  return byteLength <= limit ? value : { notRetained: true, reason: 'size_limit', byteLength };
}

async function imageEvidence(value: Json | undefined): Promise<Json> {
  if (typeof value !== 'string' || !value) return { retained: false, reason: 'no_saved_image' };
  const bytes = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), part => part.toString(16).padStart(2, '0')).join('');
  const safeInline = /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value);
  let safeUrl = false;
  try { safeUrl = new URL(value).protocol === 'https:'; } catch { /* Inline or unsupported reference. */ }
  const retained = (safeInline && bytes.byteLength <= 512 * 1024) || (safeUrl && bytes.byteLength <= 4096);
  return {
    retained, sha256, byteLength: bytes.byteLength,
    savedField: 'saved_recipes.recipe_data.imageUrl',
    ...(retained ? { reference: value, kind: safeInline ? 'inline' : 'url' } : { reason: 'image_not_retained_size_or_format' }),
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json(401, { error: 'Sign in to send a report.' });
  try {
    const { data: auth, error: authError } = await getUserClient(token).auth.getUser();
    if (authError || !auth.user) return json(401, { error: 'Sign in again to send a report.' });
    if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      return json(415, { error: 'Send a JSON report.' });

    let input: unknown;
    try { input = await readBody(req); }
    catch (error) { return json(error instanceof RangeError ? 413 : 400, { error: 'Report is too large or invalid.' }); }
    const body = record(input);
    const { source, reason, details, recipeId, message } = body;
    if (typeof source !== 'string' || !['recipe', 'image', 'chat'].includes(source) || typeof reason !== 'string' || !reasons.has(reason)
      || (details !== undefined && (typeof details !== 'string' || details.length > 500)))
      return json(400, { error: 'Choose a report reason and keep your note under 500 characters.' });
    if (source === 'chat') {
      if (typeof message !== 'string' || !message.trim() || message.length > 16000)
        return json(400, { error: 'Select one assistant response of up to 16,000 characters.' });
    } else if (typeof recipeId !== 'string' || !uuid.test(recipeId)) {
      return json(400, { error: 'Select a saved recipe.' });
    }

    const admin = getSupabaseAdmin();
    let canonicalId: string | null = null;
    let title = 'Assistant response';
    let snapshot: Json = { kind: 'chat', provenance: 'user_submitted_selected_response', content: message as string, truncated: body.messageTruncated === true };
    if (source !== 'chat') {
      const { data: recipe, error } = await admin.from('saved_recipes')
        .select('id,name,description,type,recipe_data,updated_at').eq('id', recipeId as string).eq('user_id', auth.user.id).maybeSingle();
      if (error) return json(503, { error: 'Could not retrieve that recipe. Please try again.' });
      if (!recipe) return json(404, { error: 'That saved recipe is no longer available in your account.' });
      canonicalId = recipe.id;
      title = recipe.name.slice(0, 500).replace(/[\uD800-\uDBFF]$/, '');
      const data = record(recipe.recipe_data);
      const fields: Record<string, Json> = {};
      for (const key of ['ingredients', 'instructions', 'nutrition', 'serving', 'supplements', 'safetyNotes', 'vetDisclaimer'])
        fields[key] = bounded(data[key]);
      snapshot = {
        kind: source as string, provenance: 'owned_saved_recipe_at_report_time', recipeId: recipe.id,
        title, description: recipe.description.slice(0, 2000).replace(/[\uD800-\uDBFF]$/, ''), type: recipe.type, savedUpdatedAt: recipe.updated_at,
        ...fields,
        ...(source === 'image' ? { image: await imageEvidence(data.imageUrl) } : {}),
      };
    }
    // One service-only transaction locks this user, counts durable reports in the
    // preceding hour, and inserts. No separate account-linked quota bucket survives deletion.
    const { data: savedId, error: insertError } = await admin.rpc('insert_ai_content_report_limited', {
      p_user_id: auth.user.id, p_recipe_id: canonicalId, p_source: source as string,
      p_reason: reason, p_details: typeof details === 'string' ? details.trim() : '',
      p_content_title: title, p_content_snapshot: snapshot,
    });
    if (insertError) return json(503, { error: 'Your report was not confirmed saved. Please try again.' });
    if (savedId === null) return json(429, { error: 'You have sent 10 reports in the past hour. Please try again later.' });
    if (typeof savedId !== 'string' || !uuid.test(savedId))
      return json(503, { error: 'Your report was not confirmed saved. Please try again.' });
    return json(201, { ok: true, id: savedId });
  } catch {
    return json(503, { error: 'Reports are temporarily unavailable. Please try again.' });
  }
}
