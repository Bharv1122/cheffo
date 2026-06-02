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

export interface UseSubscriptionResult {
  subscription: SubscriptionRow | null;
  loading: boolean;
  error: string | null;
  // True iff the user has paid access right now (active or trialing).
  isPremium: boolean;
  // Convenience: e.g. "Active", "Past due", "Canceled — access ends Jun 12".
  statusLabel: string;
  refresh: () => Promise<void>;
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
    return PREMIUM_STATUSES.has(subscription.status);
  }, [subscription]);

  const statusLabel = useMemo(() => statusToLabel(subscription), [subscription]);

  return {
    subscription,
    loading,
    error,
    isPremium,
    statusLabel,
    refresh: load,
  };
}
