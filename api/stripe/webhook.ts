// POST /api/stripe/webhook — Stripe → Cheffo Doggo subscription state. (CHE-34)
//
// Stripe POSTs subscription lifecycle events here. We verify the signature
// with the shared secret (whsec_…), then upsert into public.subscriptions
// so the frontend's useSubscription hook + paywall (CHE-36) reflect reality.
//
// No client should ever call this — it's strictly server-to-server. Vercel
// public route by design; the signature is the auth.
//
// Required env vars (Production + Preview):
//   STRIPE_SECRET_KEY      — sk_live_… (or sk_test_… in test mode)
//   STRIPE_WEBHOOK_SECRET  — whsec_… (from Stripe Dashboard → Developers →
//                           Webhooks → click the endpoint → Signing secret)

import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import {
  fetchStripeCustomer,
  StripeSignatureError,
  verifyStripeWebhook,
  type StripeEvent,
  type StripeSubscription,
} from '../_lib/stripe';
import type { SubscriptionStatus } from '../../src/types/database';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const HANDLED_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.trial_will_end',
]);

const VALID_STATUSES: ReadonlyArray<SubscriptionStatus> = [
  'inactive',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
  'unpaid',
];

function normalizeStatus(stripeStatus: string): SubscriptionStatus {
  return (VALID_STATUSES as readonly string[]).includes(stripeStatus)
    ? (stripeStatus as SubscriptionStatus)
    : 'inactive';
}

function unixToIso(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Look up the user_id for this Stripe customer. Fast path: an existing row in
// subscriptions already maps the customer. Slow path: fetch the Stripe
// customer and read metadata.user_id (set when the customer was created in the
// CHE-33 checkout flow).
async function resolveUserId(customerId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  if (existing?.user_id) return existing.user_id;

  try {
    const customer = await fetchStripeCustomer(customerId);
    return customer.metadata?.user_id ?? null;
  } catch (error) {
    console.error('[stripe/webhook] fetchStripeCustomer failed:', error);
    return null;
  }
}

async function handleSubscriptionEvent(event: StripeEvent): Promise<Response> {
  const subscription = event.data.object as StripeSubscription;
  if (!subscription?.customer || typeof subscription.customer !== 'string') {
    console.error('[stripe/webhook] subscription event missing customer:', event.id);
    return jsonResponse(400, { error: 'Subscription event missing customer id' });
  }

  const userId = await resolveUserId(subscription.customer);
  if (!userId) {
    // No mapping yet AND no metadata.user_id — log and 200 so Stripe stops
    // retrying. A real misconfiguration will surface in logs and stay
    // un-upserted until the metadata is fixed.
    console.error(
      `[stripe/webhook] no user_id found for customer ${subscription.customer} (event ${event.id})`
    );
    return jsonResponse(200, { ok: true, skipped: 'no_user_mapping' });
  }

  const status = event.type === 'customer.subscription.deleted'
    ? ('canceled' as SubscriptionStatus)
    : normalizeStatus(subscription.status);

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;

  const row = {
    user_id: userId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    status,
    price_id: priceId,
    current_period_start: unixToIso(subscription.current_period_start),
    current_period_end: unixToIso(subscription.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: unixToIso(subscription.canceled_at),
    trial_end: unixToIso(subscription.trial_end),
    updated_at: new Date().toISOString(),
  };

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('subscriptions')
    .upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.error(`[stripe/webhook] upsert failed for user ${userId}:`, error.message);
    // Return 500 so Stripe retries.
    return jsonResponse(500, { error: 'Database upsert failed' });
  }

  return jsonResponse(200, { ok: true, userId, status });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured');
    return jsonResponse(500, { error: 'Stripe webhook not configured' });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get('stripe-signature');

  let event: StripeEvent;
  try {
    event = await verifyStripeWebhook(rawBody, signatureHeader, secret);
  } catch (verifyError) {
    if (verifyError instanceof StripeSignatureError) {
      console.warn('[stripe/webhook] signature verification failed:', verifyError.message);
      return jsonResponse(400, { error: verifyError.message });
    }
    console.error('[stripe/webhook] verify threw:', verifyError);
    return jsonResponse(400, { error: 'Webhook verification failed' });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    // 200 = "we received it, please don't retry" — Stripe expects this for
    // event types we don't handle.
    return jsonResponse(200, { ok: true, ignored: event.type });
  }

  return handleSubscriptionEvent(event);
}
