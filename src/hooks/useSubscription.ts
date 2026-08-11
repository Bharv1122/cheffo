// Loads the signed-in user's subscription row and exposes "is premium" helpers
// for the paywall, billing UI, and any premium-only feature gates. RLS scopes
// the underlying query (subscriptions_select_own policy) so this is safe to
// call from any client surface. (CHE-37)
//
// The webhook handler (api/stripe/webhook.ts — CHE-34) is the only writer. The
// client never mutates `subscriptions`; the table has no public INSERT/UPDATE/
// DELETE policies.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { SubscriptionRow, SubscriptionStatus } from '../types/database';

// "Premium" gating: any of these statuses means the user has paid access RIGHT
// NOW. `canceled` is intentionally excluded — once the period is up Stripe
// flips status to `canceled` and we lose access.
const PREMIUM_STATUSES = new Set<SubscriptionStatus>(['active', 'trialing']);

// Dunning grace. A `past_due` subscription is a paying customer whose card just
// failed — usually an expiry or a bank decline, not a decision to leave. Stripe
// retries on its own schedule and then settles to `canceled` or `unpaid`, so
// this window is bounded (~2 weeks) rather than an open-ended free ride.
// Keeping access during it and nudging them to fix the card recovers customers
// that an instant cut-off would simply lose.
//
// `unpaid` and `incomplete_expired` deliberately get NO grace — those are the
// terminal states after Stripe has already exhausted its retries.
const GRACE_STATUSES = new Set<SubscriptionStatus>(['past_due']);

// Statuses where we should be actively asking the user to fix their card.
// `past_due` still has access (grace); the rest have already lost it.
const BILLING_PROBLEM_STATUSES = new Set<SubscriptionStatus>([
  'past_due',
  'unpaid',
  'incomplete',
  'incomplete_expired',
]);

export interface BillingProblem {
  status: SubscriptionStatus;
  // True while they still have premium access and just need to fix the card.
  // False once Stripe gave up and access is actually gone.
  inGracePeriod: boolean;
  title: string;
  body: string;
}

export interface UseSubscriptionResult {
  subscription: SubscriptionRow | null;
  loading: boolean;
  error: string | null;
  // True iff the user has paid access right now — active, trialing, or inside
  // the past_due dunning grace window.
  isPremium: boolean;
  // Convenience: e.g. "Active", "Past due", "Canceled — access ends Jun 12".
  statusLabel: string;
  // Set when the user's card needs attention; null otherwise. Drives the
  // dunning banner.
  billingProblem: BillingProblem | null;
  refresh: () => Promise<void>;
}

function describeBillingProblem(row: SubscriptionRow | null): BillingProblem | null {
  if (!row || !BILLING_PROBLEM_STATUSES.has(row.status)) return null;

  if (row.status === 'past_due') {
    return {
      status: row.status,
      inGracePeriod: true,
      title: "Your last payment didn't go through",
      body:
        "Your card was declined, so we couldn't renew your subscription. You still have full access while we retry — update your payment method to keep it that way.",
    };
  }

  if (row.status === 'incomplete') {
    return {
      status: row.status,
      inGracePeriod: false,
      title: 'Your subscription needs one more step',
      body:
        "Your first payment hasn't completed yet — it may need confirmation from your bank. Finish it to unlock Premium.",
    };
  }

  // unpaid / incomplete_expired — Stripe has stopped retrying.
  return {
    status: row.status,
    inGracePeriod: false,
    title: 'Premium is paused — your payment never went through',
    body:
      'We tried your card several times without success, so Premium access has stopped. Update your payment method to turn it back on. Your dogs and recipes are all still here.',
  };
}

function statusToLabel(row: SubscriptionRow | null): string {
  if (!row) return 'Free';
  switch (row.status) {
    case 'active':
      return row.cancel_at_period_end ? 'Canceling at period end' : 'Active';
    case 'trialing':
      return 'Trialing';
    case 'past_due':
      return 'Past due';
    case 'paused':
      return 'Paused';
    case 'canceled':
      return 'Canceled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'Payment incomplete';
    case 'unpaid':
      return 'Unpaid';
    case 'inactive':
    default:
      return 'Free';
  }
}

export function useSubscription(): UseSubscriptionResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  // Start true: on first render the subscription row hasn't loaded yet, so
  // `isPremium` is still false. Consumers (the paywall) must be able to tell
  // "not premium" apart from "not loaded yet" — otherwise a premium user is
  // briefly treated as free and the upgrade modal fires on their first click.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId || !supabase) {
      setSubscription(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!mountedRef.current) return;
      if (queryError) {
        // A missing row is the normal "never subscribed" case — `maybeSingle`
        // returns data=null, error=null. Any other error is real.
        setError(queryError.message);
        setSubscription(null);
      } else {
        setSubscription(data as SubscriptionRow | null);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load subscription.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isPremium = useMemo(() => {
    if (!subscription) return false;
    return (
      PREMIUM_STATUSES.has(subscription.status) || GRACE_STATUSES.has(subscription.status)
    );
  }, [subscription]);

  const statusLabel = useMemo(() => statusToLabel(subscription), [subscription]);
  const billingProblem = useMemo(() => describeBillingProblem(subscription), [subscription]);

  return {
    subscription,
    loading,
    error,
    isPremium,
    statusLabel,
    billingProblem,
    refresh: load,
  };
}
