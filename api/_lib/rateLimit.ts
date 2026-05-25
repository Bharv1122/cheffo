// Per-IP rate limit for the unauthenticated public approval endpoints (CHE-130).
//
// The vet-approval token (256-bit, sha256-hashed in the DB) makes brute-forcing
// infeasible, so this isn't about preventing forgery — it's about capping the
// cost of a flood of guessing requests. Default budget is generous; tune via
// env if a real bot ever shows up.

import { getSupabaseAdmin } from './supabaseAdmin';

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_LIMIT_PER_WINDOW = 30;

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function checkIpRateLimit(
  req: Request,
  scope: string,
  options: { windowSeconds?: number; limit?: number } = {}
): Promise<RateLimitDecision> {
  const windowSeconds = options.windowSeconds ?? Number(process.env.RATE_LIMIT_WINDOW_SECONDS) || DEFAULT_WINDOW_SECONDS;
  const limit = options.limit ?? Number(process.env.RATE_LIMIT_PER_WINDOW) || DEFAULT_LIMIT_PER_WINDOW;

  const ipHash = await getRequestIpHash(req);
  if (!ipHash) {
    // No client IP available (likely a local-dev request). Allow but log so
    // we don't accidentally disable the limiter in prod.
    console.warn(`[rateLimit:${scope}] no client IP available; allowing`);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  try {
    const { data, error } = await getSupabaseAdmin().rpc('check_and_increment_ip_rate_limit', {
      p_ip_hash: ipHash,
      p_scope: scope,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    });
    if (error) {
      // Fail open — a broken limiter shouldn't take down legitimate use.
      console.error(`[rateLimit:${scope}] RPC failed, allowing:`, error.message);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      return { allowed: false, retryAfterSeconds: windowSeconds };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch (rateError) {
    console.error(`[rateLimit:${scope}] threw, allowing:`, rateError);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

// Return a 429 Response when the limiter blocks. Caller short-circuits on this.
export function tooManyRequestsResponse(decision: RateLimitDecision): Response {
  return new Response(JSON.stringify({ error: 'Too many requests — please slow down.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Retry-After': String(decision.retryAfterSeconds),
    },
  });
}

// Hash the client IP with a server-side salt so the DB never stores raw IPs.
// Vercel Edge forwards the client IP as the first entry of `x-forwarded-for`.
async function getRequestIpHash(req: Request): Promise<string | null> {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    null;
  if (!ip) return null;

  const salt = process.env.IP_HASH_SALT ?? 'cheffo-doggo-default-ip-salt';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${ip}`)
  );
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
