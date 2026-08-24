import { getSupabaseAdmin, getUserClient } from '../_lib/supabaseAdmin';

export const config = { runtime: 'edge' };

const CAMPAIGN = {
  code: 'ALEXAN30',
  slug: 'alexan30',
  trialDays: 3,
  expiresAt: '2026-12-31T23:59:59Z',
  maxRedemptions: 250,
} as const;

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
  if (!accessToken) return jsonResponse(401, { error: 'Sign in to apply the campaign code.' });

  const body = await req.json().catch(() => ({})) as { code?: unknown };
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (code !== CAMPAIGN.code) {
    return jsonResponse(400, { error: 'That campaign code is not recognized.' });
  }
  if (Date.now() > Date.parse(CAMPAIGN.expiresAt)) {
    return jsonResponse(410, { error: 'That campaign has ended.' });
  }

  const { data, error: userError } = await getUserClient(accessToken).auth.getUser();
  if (userError || !data.user) return jsonResponse(401, { error: 'Your session has expired.' });

  const admin = getSupabaseAdmin();
  const { data: existing, error: existingError } = await admin
    .from('subscriptions')
    .select('status, campaign_code, campaign_trial_end')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (existingError) return jsonResponse(500, { error: 'Could not check campaign eligibility.' });

  if (existing?.campaign_code === CAMPAIGN.slug) {
    const active = existing.campaign_trial_end && Date.parse(existing.campaign_trial_end) > Date.now();
    return active
      ? jsonResponse(200, {
          message: 'ALEXAN30 is already active on this account.',
          campaign: CAMPAIGN.slug,
          trialDays: CAMPAIGN.trialDays,
          trialEnd: existing.campaign_trial_end,
          noCardRequired: true,
        })
      : jsonResponse(409, { error: 'ALEXAN30 has already been used on this account.' });
  }

  if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
    return jsonResponse(409, { error: 'This account already has Premium access.' });
  }

  const { count, error: countError } = await admin
    .from('subscriptions')
    .select('user_id', { count: 'exact', head: true })
    .eq('campaign_code', CAMPAIGN.slug);
  if (countError) return jsonResponse(500, { error: 'Could not check campaign availability.' });
  if ((count ?? 0) >= CAMPAIGN.maxRedemptions) {
    return jsonResponse(409, { error: 'This campaign has reached its redemption limit.' });
  }

  const redeemedAt = new Date();
  const trialEnd = new Date(redeemedAt.getTime() + CAMPAIGN.trialDays * 86_400_000);
  const { error: saveError } = await admin.from('subscriptions').upsert({
    user_id: data.user.id,
    campaign_code: CAMPAIGN.slug,
    campaign_redeemed_at: redeemedAt.toISOString(),
    campaign_trial_end: trialEnd.toISOString(),
  }, { onConflict: 'user_id' });
  if (saveError) return jsonResponse(500, { error: 'Could not activate the campaign trial.' });

  return jsonResponse(200, {
    message: 'ALEXAN30 activated — 3 days of full Premium, no card required.',
    campaign: CAMPAIGN.slug,
    trialDays: CAMPAIGN.trialDays,
    trialEnd: trialEnd.toISOString(),
    noCardRequired: true,
  });
}
