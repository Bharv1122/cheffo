// POST /api/stripe/checkout — start a Stripe Checkout session for the
// monthly or yearly Cheffo Doggo Premium plan. (CHE-33)
//
// Auth: Authorization: Bearer <supabase access token>
// Body: { plan: "monthly" | "yearly" }
//
// Flow:
//   1. Authenticate the caller via Supabase.
//   2. Look up (or create) a Stripe Customer matched to the user. We store
//      stripe_customer_id on subscriptions for the fast path; if missing,
//      we search by email and create one with `metadata.user_id` set so
//      the webhook handler (CHE-34) can map subscription events back to a
//      user even if the subscriptions row isn't there yet.
//   3. Create a Checkout Session in subscription mode for the chosen price.
//   4. Return { url } — the client redirects there.

import { getSupabaseAdmin, getUserClient } from '../_lib/supabaseAdmin';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

interface CheckoutBody {
  plan?: unknown;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// urlencoded form body — Stripe REST API takes application/x-www-form-urlencoded,
// not JSON. Handles nested keys via bracket notation (line_items[0][price]).
function formEncode(params: Record<string, string | number | boolean>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function stripeApi<T>(path: string, params: Record<string, string | number | boolean>, secretKey: string): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formEncode(params),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Stripe ${path} failed (${response.status}): ${errText}`);
  }
  return (await response.json()) as T;
}

async function stripeApiGet<T>(path: string, secretKey: string): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Stripe ${path} failed (${response.status}): ${errText}`);
  }
  return (await response.json()) as T;
}

interface StripeCustomerListResponse {
  data: Array<{ id: string; metadata: { user_id?: string } }>;
}

interface StripeCustomerResponse {
  id: string;
}

interface StripeCheckoutSession {
  id: string;
  url: string;
}

// Look up an existing Customer for this user, or create one. Tries (in order):
// 1. stripe_customer_id from our subscriptions row (fastest, exact mapping).
// 2. Customer search by email (handles users who subscribed once, canceled,
//    then resubscribed — Stripe keeps the customer).
// 3. Create a brand-new Customer with metadata.user_id set.
async function getOrCreateCustomer(
  userId: string,
  userEmail: string,
  secretKey: string
): Promise<string> {
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  // Search Stripe for an existing customer by email (handles stale state).
  const search = await stripeApiGet<StripeCustomerListResponse>(
    `/customers?email=${encodeURIComponent(userEmail)}&limit=1`,
    secretKey
  );
  if (search.data.length > 0 && search.data[0].metadata?.user_id === userId) {
    return search.data[0].id;
  }

  // Create new Customer with metadata so the webhook can map back to user_id.
  const created = await stripeApi<StripeCustomerResponse>(
    '/customers',
    {
      email: userEmail,
      'metadata[user_id]': userId,
    },
    secretKey
  );
  return created.id;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY;
  const yearlyPriceId = process.env.STRIPE_PRICE_YEARLY;
  if (!secretKey || !monthlyPriceId || !yearlyPriceId) {
    return jsonResponse(500, { error: 'Stripe checkout is not configured yet.' });
  }

  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) return jsonResponse(401, { error: 'Sign in to subscribe.' });

  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  const plan = body.plan === 'monthly' || body.plan === 'yearly' ? body.plan : null;
  if (!plan) return jsonResponse(400, { error: 'plan must be "monthly" or "yearly"' });

  const userClient = getUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user?.email) {
    return jsonResponse(401, { error: 'Your session has expired — please sign in again.' });
  }
  const user = userData.user;

  const url = new URL(req.url);
  const origin = process.env.PUBLIC_APP_ORIGIN ?? `${url.protocol}//${url.host}`;
  const priceId = plan === 'monthly' ? monthlyPriceId : yearlyPriceId;

  try {
    const customerId = await getOrCreateCustomer(user.id, user.email!, secretKey);
    const session = await stripeApi<StripeCheckoutSession>(
      '/checkout/sessions',
      {
        mode: 'subscription',
        customer: customerId,
        client_reference_id: user.id,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': 1,
        success_url: `${origin}/settings?upgrade=success`,
        cancel_url: `${origin}/pricing?canceled=1`,
        allow_promotion_codes: true,
      },
      secretKey
    );
    return jsonResponse(200, { url: session.url });
  } catch (error) {
    console.error('[stripe/checkout] failed:', error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Could not start checkout.',
    });
  }
}
