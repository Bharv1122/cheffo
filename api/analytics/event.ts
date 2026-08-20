import { checkIpRateLimit, tooManyRequestsResponse } from '../_lib/rateLimit';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';

export const config = { runtime: 'edge' };

const ALLOWED_EVENTS = new Set([
  'preview_started', 'signup_viewed', 'signup_completed',
  'profile_completed', 'recipe_generated', 'return_visit',
]);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export default async function handler(req: Request): Promise<Response> {
  const startedAt = Date.now();
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  const rateDecision = await checkIpRateLimit(req, 'funnel-event', { limit: 60 });
  if (!rateDecision.allowed) return tooManyRequestsResponse(rateDecision);

  let body: { event?: unknown; path?: unknown; source?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const eventName = clean(body.event, 40);
  if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
    return jsonResponse(400, { error: 'Unknown analytics event' });
  }

  const { error } = await getSupabaseAdmin().from('funnel_events').insert({
    event_name: eventName,
    path: clean(body.path, 120),
    source: clean(body.source, 60),
  });
  if (error) {
    console.error(JSON.stringify({ level: 'error', msg: 'funnel event failed', event: eventName, error: error.message, ms: Date.now() - startedAt }));
    return jsonResponse(500, { error: 'Could not record event' });
  }
  console.log(JSON.stringify({ level: 'info', msg: 'funnel event recorded', event: eventName, ms: Date.now() - startedAt }));
  return jsonResponse(202, { recorded: true });
}
