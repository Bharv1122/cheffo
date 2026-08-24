import { getSupabaseAdmin, getUserClient } from '../_lib/supabaseAdmin';

export const config = { runtime: 'edge' };

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!token) return json(401, { error: 'Please sign in first.' });

  const body = await req.json().catch(() => ({})) as { code?: unknown; source?: unknown };
  const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
  if (code !== '3dayfree') return json(400, { error: 'That code is not recognized.' });

  const { data, error: authError } = await getUserClient(token).auth.getUser();
  if (authError || !data.user?.email) return json(401, { error: 'Your session has expired.' });

  const source = typeof body.source === 'string' ? body.source.slice(0, 40) : null;
  const { data: redemption, error } = await getSupabaseAdmin().rpc('redeem_3dayfree_campaign', {
    p_user_id: data.user.id,
    p_email_hash: await sha256(data.user.email),
    p_source: source,
  });

  if (error) {
    if (error.message.includes('campaign_already_redeemed')) {
      return json(409, { error: 'This trial has already been used by this account.' });
    }
    if (error.message.includes('already_premium')) {
      return json(409, { error: 'This account already has Premium access.' });
    }
    console.error('[campaign/redeem] failed:', error.message);
    return json(500, { error: 'Could not activate the trial. Please try again.' });
  }

  const row = Array.isArray(redemption) ? redemption[0] : redemption;
  return json(200, {
    ok: true,
    code: '3DAYFREE',
    app: 'cheffo-doggo',
    trialEnd: row?.trial_end ?? null,
    message: '3 days of full Premium are active. No credit card required.',
  });
}
