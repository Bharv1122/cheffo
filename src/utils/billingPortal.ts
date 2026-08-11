// Shared "open Stripe's hosted billing portal" call.
//
// The portal is where a customer updates a failed card, so every dunning
// surface needs it. It only requires a stripe_customer_id, which a past_due or
// unpaid subscriber still has — so this works precisely when they need it.

import { supabase } from '../lib/supabase';

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Ask the server for a billing-portal session and send the browser there.
 * Throws with a user-showable message on failure; the caller renders it.
 */
export async function openBillingPortal(): Promise<void> {
  const response = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: await buildAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: 'Could not open billing portal.' }));
    throw new Error(err.error ?? 'Could not open billing portal.');
  }
  const { url } = (await response.json()) as { url: string };
  window.location.href = url;
}
