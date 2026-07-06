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

// Resolve the calling user from the Supabase access token. Returns the user id
// on success, or a Response to return as-is on failure.
//
// TODO(paywall): once Stripe subscriptions exist, also require an active paid
// subscription here (look up the user's subscription row) so the LLM becomes
// premium-only. Today there is no subscription data, so we gate on "signed in".
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

  // 1. Authenticate — anonymous visitors cannot spend the LLM budget.
  const auth = await authorizeUser(req);
  if ('error' in auth) return auth.error;

  // 2. Premium gate (CHE-36). Chat completions power the premium "Ask Cheffo
  // Doggo" assistant + AI personalization, so they require an active/trialing
  // subscription — matching useSubscription's PREMIUM_STATUSES on the client.
  // Image generation (`?type=image`) stays open to any signed-in user: the
  // FREE "1 treat recipe" taste renders its photo through this same proxy, and
  // free recipe TEXT is template-generated (never hits /api/llm). Without this,
  // a free user could bypass the client paywall and call chat directly.
  const isImageRequest = new URL(req.url).searchParams.get('type') === 'image';
  if (!isImageRequest) {
    try {
      const { data: sub, error: subError } = await getSupabaseAdmin()
        .from('subscriptions')
        .select('status')
        .eq('user_id', auth.userId)
        .maybeSingle();
      if (subError) {
        // Consistent with the rate limiter below: a broken lookup shouldn't
        // lock a paying user out of the assistant. Log and allow.
        console.error('[llm] premium check failed, allowing:', subError.message);
      } else {
        const isPremium = sub?.status === 'active' || sub?.status === 'trialing';
        if (!isPremium) {
          return jsonError(
            403,
            'Ask Cheffo Doggo is a Premium feature — upgrade to chat with the AI assistant.'
          );
        }
      }
    } catch (premiumError) {
      console.error('[llm] premium check threw, allowing:', premiumError);
    }
  }

  // 3. Per-user daily rate limit (atomic check-and-increment in Postgres).
  const dailyLimit = Number(process.env.LLM_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  try {
    const { data, error } = await getSupabaseAdmin().rpc('check_and_increment_llm_usage', {
      p_user_id: auth.userId,
      p_daily_limit: dailyLimit,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error) {
      // If the limiter itself errors, log and allow — a broken limiter
      // shouldn't take down the assistant for legitimate users.
      console.error('[llm] rate-limit check failed, allowing request:', error.message);
    } else if (row && row.allowed === false) {
      return jsonError(429, `Daily AI limit reached (${dailyLimit} requests). Try again tomorrow.`);
    }
  } catch (rateError) {
    console.error('[llm] rate-limit check threw, allowing request:', rateError);
  }

  // 4. Forward to the upstream provider. An `?type=image` request goes to the
  // OpenAI-compatible /images/generations endpoint; everything else is a chat
  // completion. Same host, same key — only the path differs.
  const body = await req.text();
  if (body.length > MAX_BODY_CHARS) return jsonError(413, 'Request body too large');

  const upstreamPath = isImageRequest ? '/images/generations' : '/chat/completions';

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/+$/, '')}${upstreamPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });
  } catch {
    return jsonError(502, 'Upstream LLM request failed');
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
