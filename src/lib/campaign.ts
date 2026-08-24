import { supabase } from './supabase';

export const PUBLIC_CAMPAIGN_CODE = '3DAYFREE';

export async function redeemCampaignCode(
  rawCode: string,
  accessToken?: string,
): Promise<{ message: string; error: string | null }> {
  const code = rawCode.trim().toUpperCase();
  if (code !== PUBLIC_CAMPAIGN_CODE) {
    return { message: '', error: 'That code is not recognized.' };
  }

  let token = accessToken;
  if (!token && supabase) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  }
  if (!token) return { message: '', error: 'Please sign in first.' };

  let source: string | null = null;
  try {
    source = localStorage.getItem('cheffo_src');
  } catch {
    // Attribution is best-effort; entitlement is not.
  }

  const response = await fetch('/api/campaign/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code, source }),
  });
  const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
  return response.ok
    ? { message: result.message ?? '3-day Premium trial activated.', error: null }
    : { message: '', error: result.error ?? 'Could not activate the trial.' };
}
