// POST /api/stripe/portal — redirect a subscribed user to Stripe's hosted
// billing portal so they can update payment method, view invoices, or cancel.
// (CHE-35)
//
// Auth: Authorization: Bearer <supabase access token>
// Returns: { url } — the client redirects there.

import { getSupabaseAdmin, getUserClient } from '../_lib/supabaseAdmin';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return jsonResponse(500, { error: 'Stripe is not configured.' });

  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) return jsonResponse(401, { error: 'Sign in to manage your subscription.' });

  const userClient = getUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse(401, { error: 'Your session has expired — please sign in again.' });
  const user = userData.user;

  const admin = getSupabaseAdmin();
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!subscription?.stripe_customer_id) {
    return jsonResponse(400, {
      error: 'No active subscription to manage. Subscribe first to access the billing portal.',
    });
  }

  const url = new URL(req.url);
  const origin = process.env.PUBLIC_APP_ORIGIN ?? `${url.protocol}//${url.host}`;

  try {
    const response = await fetch(`${STRIPE_API_BASE}/billing_portal/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formEncode({
        customer: subscription.stripe_customer_id,
        return_url: `${origin}/settings`,
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Stripe billing_portal.sessions failed (${response.status}): ${errText}`);
    }
    const session = (await response.json()) as { url: string };
    return jsonResponse(200, { url: session.url });
  } catch (error) {
    console.error('[stripe/portal] failed:', error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Could not open billing portal.',
    });
  }
}
