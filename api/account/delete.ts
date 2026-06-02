// POST /api/account/delete — permanently delete the calling user and all of
// their data. Apple requires in-app account deletion for any app that supports
// account creation, and GDPR/CCPA require a right-to-erasure path. (CHE-42)
//
// Auth: Authorization: Bearer <supabase access token>.
// Body: { confirm: "<the user's email>" } — defensive double-confirm so a
// runaway client can't wipe an account without the user typing their email.
//
// Order of operations matters: delete the user's data rows FIRST (so we don't
// leave orphans if the auth.users delete succeeds and the data deletes don't),
// then delete the auth.users row LAST. Each delete uses the user-scoped
// client so RLS still gates the operation — we never bypass user identity.
// The final auth.users delete needs service-role because users can't delete
// themselves via the auth API.

import { getSupabaseAdmin, getUserClient } from '../_lib/supabaseAdmin';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

// Stripe statuses that mean a subscription is still live and billable, so it
// must be cancelled before we erase the account or the user keeps being charged.
const BILLABLE_STRIPE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete']);

interface DeleteBody {
  confirm?: unknown;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) return jsonResponse(401, { error: 'Sign in to delete your account.' });

  let body: DeleteBody;
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const userClient = getUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse(401, { error: 'Your session has expired — please sign in again.' });
  }
  const user = userData.user;

  // Defensive check — UI requires the user to type their email exactly, and
  // the server independently verifies it matches.
  const confirm = typeof body.confirm === 'string' ? body.confirm.trim().toLowerCase() : '';
  if (!confirm || !user.email || confirm !== user.email.toLowerCase()) {
    return jsonResponse(400, { error: 'Type your email exactly to confirm account deletion.' });
  }

  const admin = getSupabaseAdmin();

  // Cancel any live Stripe subscription FIRST, before erasing data. A deleted
  // account must never keep getting billed. If cancellation fails we abort
  // WITHOUT touching the user's data, so they can resolve billing (or retry)
  // rather than ending up deleted-but-still-charged with the link gone.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, status')
    .eq('user_id', user.id)
    .maybeSingle();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (sub?.stripe_subscription_id && BILLABLE_STRIPE_STATUSES.has(sub.status as string)) {
    if (!stripeSecretKey) {
      // Misconfigured env (no key) — don't silently leave them billed.
      console.error('[account/delete] live subscription but STRIPE_SECRET_KEY missing — cannot cancel', { userId: user.id });
      return jsonResponse(500, {
        error: 'We could not cancel your subscription automatically. Please cancel it in Settings → Manage subscription first, then delete your account.',
      });
    }
    try {
      const cancelResp = await fetch(`${STRIPE_API_BASE}/subscriptions/${encodeURIComponent(sub.stripe_subscription_id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      });
      // 404 means Stripe already has no such subscription (already cancelled) —
      // treat as success and continue with deletion.
      if (!cancelResp.ok && cancelResp.status !== 404) {
        const errText = await cancelResp.text().catch(() => '');
        console.error('[account/delete] Stripe cancel failed:', cancelResp.status, errText);
        return jsonResponse(502, {
          error: 'We could not cancel your subscription automatically. Please cancel it in Settings → Manage subscription (or contact support), then try deleting again.',
        });
      }
    } catch (e) {
      console.error('[account/delete] Stripe cancel threw:', e);
      return jsonResponse(502, {
        error: 'We could not reach Stripe to cancel your subscription. Please try again in a moment, or cancel in Settings → Manage subscription first.',
      });
    }
  }

  // Delete data first — under RLS the user can only ever delete their own
  // rows, so even if the WHERE clauses were tampered with these are bounded.
  const deletions = await Promise.all([
    userClient.from('approvals').delete().eq('user_id', user.id),
    userClient.from('saved_recipes').delete().eq('user_id', user.id),
    userClient.from('dog_profiles').delete().eq('user_id', user.id),
    userClient.from('user_preferences').delete().eq('user_id', user.id),
  ]);
  // llm_usage and subscriptions are service-role-managed (no user-side DELETE
  // policy), so we wipe them via the admin client.
  await admin.from('llm_usage').delete().eq('user_id', user.id);
  await admin.from('subscriptions').delete().eq('user_id', user.id);

  const errors = deletions
    .map(r => r.error)
    .filter((e): e is Exclude<typeof e, null> => Boolean(e));
  if (errors.length > 0) {
    return jsonResponse(500, {
      error: 'Some of your data could not be deleted — please contact support.',
      details: errors.map(e => e.message),
    });
  }

  // Finally, delete the auth.users row. This invalidates all sessions and
  // makes a future signup with the same email a brand-new account.
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    // Data already wiped but the auth row is still here — surface so the user
    // can retry. Their next sign-in will see an empty account.
    console.error('[account/delete] auth.users delete failed:', authDeleteError.message);
    return jsonResponse(500, {
      error: 'Your data was deleted, but the final account-removal step failed. Please contact support to finish removing your login.',
    });
  }

  return jsonResponse(200, { ok: true });
}
