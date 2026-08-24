import { supabase } from './supabase';

export interface PartnerRedeemResult {
  ok: boolean;
  error: string | null;
  trialEnd: string | null;
}

export async function redeemPartnerCode(code: string): Promise<PartnerRedeemResult> {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'Sign in to apply the campaign code.', trialEnd: null };

  const response = await fetch('/api/partner-offer/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    error: response.ok ? null : payload.error ?? 'Could not apply that campaign code.',
    trialEnd: response.ok ? payload.trialEnd ?? null : null,
  };
}
