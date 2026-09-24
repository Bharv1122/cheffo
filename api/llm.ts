// Server-side proxy for the LLM provider.
//
// The client used to call the provider directly with `VITE_LLM_API_KEY`, but
// Vite inlines VITE_-prefixed vars into the bundle, leaking the key to every
// visitor (CHE-5). The client now POSTs its OpenAI-compatible chat-completions
// body to /api/llm; this function attaches the bearer key server-side and
// streams the upstream response straight back.
//
// CHE-14 — abuse protection & cost control:
//   * Auth-gated: the caller must present a valid Supabase access token. An
//     unauthenticated visitor cannot spend the LLM budget.
//   * Per-user daily cap: each user gets at most LLM_DAILY_LIMIT requests/day,
//     enforced atomically in Postgres (`check_and_increment_llm_usage`).

import { getSupabaseAdmin, getUserClient } from './_lib/supabaseAdmin';

export const config = { runtime: 'edge' };

// The Edge runtime exposes process.env, but the app tsconfig's `vite/client`
// types don't declare it — declare the minimal shape locally.
declare const process: { env: Record<string, string | undefined> };

// Generous cap — a chat body is a system prompt plus up to 16 trimmed turns.
// Guards this same-origin proxy against oversized requests to a paid API.
const MAX_BODY_CHARS = 256 * 1024;

// Per-user requests per day. High enough that a real heavy session is never
// blocked, low enough that a scripted abuser is stopped fast. Tune via env.
const DEFAULT_DAILY_LIMIT = 100;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Provider diagnostics deliberately omit messages, stacks, destinations,
// headers and bodies. Only fixed labels and allowlisted transport codes leave
// this boundary; unknown runtime-specific values are represented as unknown.
const SAFE_FETCH_ERROR_NAMES = new Set(['Error', 'TypeError', 'AbortError', 'TimeoutError', 'NetworkError']);
const SAFE_FETCH_CAUSE_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);

function logUpstreamFetchFailure(error: unknown): void {
  let errorName = 'unknown';
  let causeCode = 'unknown';
  // Be defensive about arbitrary rejection values, including throwing getters.
  try {
    if (error && typeof error === 'object') {
      const value = error as { name?: unknown; cause?: { code?: unknown } };
      const name = value.name;
      if (typeof name === 'string' && SAFE_FETCH_ERROR_NAMES.has(name)) errorName = name;
      const code = value.cause?.code;
      if (typeof code === 'string' && SAFE_FETCH_CAUSE_CODES.has(code)) causeCode = code;
    }
  } catch { /* Keep fixed unknown values; never inspect or stringify the error. */ }
  console.error('[llm] upstream_failure', { stage: 'fetch_exception', status: 502, errorName, causeCode });
}

// Resolve the calling user from the Supabase access token. Returns the user id
// on success, or a Response to return as-is on failure.
//
// Entitlement and quota checks run after authentication and must succeed
// before any request can spend the upstream provider budget.
async function authorizeUser(req: Request): Promise<{ userId: string } | { error: Response }> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { error: jsonError(401, 'Sign in to use the AI assistant.') };
  }
  try {
    const { data, error } = await getUserClient(token).auth.getUser();
    if (error || !data?.user) {
      return { error: jsonError(401, 'Your session has expired — please sign in again.') };
    }
    // Fresh server-authenticated data; no user_metadata, body, or admin exemption.
    if (data.user.app_metadata?.cheffo_adult_confirmed !== true) {
      return { error: new Response(JSON.stringify({ error: 'Confirm that you are at least 18 before using AI features.', code: 'ADULT_CONFIRMATION_REQUIRED' }), {
        status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }) };
    }
    return { userId: data.user.id };
  } catch {
    return { error: jsonError(401, 'Could not verify your session.') };
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonError(405, 'Method not allowed');

  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  if (!apiKey || !baseUrl) return jsonError(500, 'LLM proxy is not configured');

  // Credentials and user content must never leave over plaintext or be
  // forwarded through a redirect to a different transport/destination.
  let upstreamBase: string;
  try {
    const parsedBase = new URL(baseUrl);
    if (parsedBase.protocol !== 'https:' || parsedBase.username || parsedBase.password ||
        parsedBase.search || parsedBase.hash) {
      return jsonError(500, 'LLM proxy has an invalid secure endpoint configuration');
    }
    upstreamBase = parsedBase.href.replace(/\/+$/, '');
  } catch {
    return jsonError(500, 'LLM proxy has an invalid secure endpoint configuration');
  }

  // 1. Authenticate — anonymous visitors cannot spend the LLM budget.
  const auth = await authorizeUser(req);
  if ('error' in auth) return auth.error;

  // 2. Premium gate (CHE-36). Chat completions power the premium "Ask Cheffo
  // Doggo" assistant + AI personalization, so they require an active/trialing
  // subscription — matching useSubscription's PREMIUM_STATUSES on the client.
  // Generated images are Premium too. The free treat uses the existing static
  // image fallback, so direct image requests cannot bypass paid access checks.
  const isImageRequest = new URL(req.url).searchParams.get('type') === 'image';
  {
    try {
      const { data: sub, error: subError } = await getSupabaseAdmin()
        .from('subscriptions')
        .select('status, campaign_code, campaign_trial_end')
        .eq('user_id', auth.userId)
        .maybeSingle();
      if (subError) {
        // An unavailable entitlement is not a verified entitlement.
        console.error('[llm] premium check failed:', subError.message);
        return jsonError(503, 'Could not verify your account access. Please try again shortly.');
      } else {
        // `past_due` is included on purpose: it's the dunning grace window for
        // a paying customer whose card just failed. This MUST match
        // useSubscription's PREMIUM_STATUSES + GRACE_STATUSES on the client —
        // otherwise the app tells them they still have access while the
        // assistant 403s at them. Stripe settles past_due to canceled/unpaid
        // within ~2 weeks, and neither of those is allowed here.
        const activeCampaign =
          sub?.campaign_code === '3dayfree' &&
          Boolean(sub.campaign_trial_end) &&
          Date.parse(sub.campaign_trial_end as string) > Date.now();
        const isPremium = sub?.campaign_code
          ? activeCampaign
          : sub?.status === 'active' || sub?.status === 'trialing' || sub?.status === 'past_due';
        if (!isPremium) {
          return jsonError(
            403,
            'AI chat and generated recipe images require Premium access.'
          );
        }
      }
    } catch (premiumError) {
      console.error('[llm] premium check threw:', premiumError);
      return jsonError(503, 'Could not verify your account access. Please try again shortly.');
    }
  }

  // Invalid requests must not consume the user's daily AI allowance.
  const body = await req.text();
  if (body.length > MAX_BODY_CHARS) return jsonError(413, 'Request body too large');

  // 3. Per-user daily rate limit (atomic check-and-increment in Postgres).
  const dailyLimit = Number(process.env.LLM_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  try {
    const { data, error } = await getSupabaseAdmin().rpc('check_and_increment_llm_usage', {
      p_user_id: auth.userId,
      p_daily_limit: dailyLimit,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error) {
      console.error('[llm] rate-limit check failed:', error.message);
      return jsonError(503, 'AI usage limits are temporarily unavailable. Please try again shortly.');
    } else if (!row || typeof row.allowed !== 'boolean') {
      return jsonError(503, 'AI usage limits are temporarily unavailable. Please try again shortly.');
    } else if (row.allowed === false) {
      return jsonError(429, `Daily AI limit reached (${dailyLimit} requests). Try again tomorrow.`);
    }
  } catch (rateError) {
    console.error('[llm] rate-limit check threw:', rateError);
    return jsonError(503, 'AI usage limits are temporarily unavailable. Please try again shortly.');
  }

  // 4. Forward to the upstream provider. An `?type=image` request goes to the
  // OpenAI-compatible /images/generations endpoint; everything else is a chat
  // completion. Same host, same key — only the path differs.
  const upstreamPath = isImageRequest ? '/images/generations' : '/chat/completions';

  let upstream: Response;
  try {
    upstream = await fetch(`${upstreamBase}${upstreamPath}`, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
  } catch (error) {
    logUpstreamFetchFailure(error);
    return jsonError(502, 'Upstream LLM request failed');
  }

  if (!upstream.ok) {
    console.error('[llm] upstream_failure', { stage: 'http_response', status: upstream.status });
  }

  // Stream the upstream response through unbuffered — keeps SSE chat working.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
