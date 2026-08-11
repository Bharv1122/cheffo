import React, { useState } from 'react';
import { AlertTriangle, CreditCard, Loader2, X } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { openBillingPortal } from '../../utils/billingPortal';

// Dismissals last for the browser session only. A failed card is not something
// to let someone permanently hide — but nagging them on every single page view
// after they've seen it is how banners get ignored. Dismiss for now, back on
// the next visit, until the card is actually fixed.
const DISMISS_KEY_PREFIX = 'cheffo:billing-banner-dismissed:';

/**
 * Dunning banner. Renders on every authenticated page when Stripe says the
 * customer's card needs attention.
 *
 * Two tiers:
 *  - past_due  -> amber. They still have full access; this is a nudge.
 *  - unpaid / incomplete_expired -> red. Access is gone; this is the recovery
 *    path.
 */
export function PaymentProblemBanner() {
  const { billingProblem, loading } = useSubscription();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Key the dismissal on the status so an escalation (past_due -> unpaid)
  // re-surfaces the banner even if they dismissed the milder one.
  const dismissKey = billingProblem ? `${DISMISS_KEY_PREFIX}${billingProblem.status}` : '';
  const [dismissed, setDismissed] = useState(() => {
    try {
      return Boolean(dismissKey) && sessionStorage.getItem(dismissKey) === '1';
    } catch {
      return false;
    }
  });

  if (loading || !billingProblem || dismissed) return null;

  const grace = billingProblem.inGracePeriod;

  function handleDismiss() {
    try {
      sessionStorage.setItem(dismissKey, '1');
    } catch {
      // sessionStorage unavailable — banner just returns on next render
    }
    setDismissed(true);
  }

  async function handleFixCard() {
    setOpening(true);
    setError(null);
    try {
      await openBillingPortal();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open billing portal.');
      setOpening(false);
    }
  }

  return (
    <div
      role="alert"
      className={
        grace
          ? 'mb-4 rounded-2xl border border-[#f4ddc1] bg-[#fff8ee] p-4'
          : 'mb-4 rounded-2xl border border-red-200 bg-red-50 p-4'
      }
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={18}
          className={grace ? 'mt-0.5 shrink-0 text-[#f97316]' : 'mt-0.5 shrink-0 text-red-600'}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className={grace ? 'font-semibold text-[#5b4a37]' : 'font-semibold text-red-800'}>
            {billingProblem.title}
          </p>
          <p className={grace ? 'mt-1 text-sm text-[#7e6b54]' : 'mt-1 text-sm text-red-700'}>
            {billingProblem.body}
          </p>

          {error && (
            <p className="mt-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleFixCard}
            disabled={opening}
            className={
              grace
                ? 'mt-3 inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#ea6a0c] disabled:opacity-60'
                : 'mt-3 inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60'
            }
          >
            {opening ? (
              <>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Opening secure portal…
              </>
            ) : (
              <>
                <CreditCard size={15} aria-hidden="true" />
                Update payment method
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss for now"
          className={
            grace
              ? 'shrink-0 rounded-lg p-1 text-[#9c8568] hover:bg-[#f4ddc1]'
              : 'shrink-0 rounded-lg p-1 text-red-400 hover:bg-red-100'
          }
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
