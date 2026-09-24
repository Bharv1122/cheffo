import { getSupabaseAdmin, getUserClient } from '../_lib/supabaseAdmin';

export const config = { runtime: 'edge' };
const respond = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Self-attestation, not identity or age verification. Only this authenticated
// server endpoint writes the authorization flag; user_metadata is never trusted.
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return respond(405, { error: 'Method not allowed' });
  const header = req.headers.get('authorization');
  const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7) : null;
  if (!token) return respond(401, { error: 'Sign in to confirm your age.' });
  try {
    const { data, error } = await getUserClient(token).auth.getUser();
    if (error || !data?.user) return respond(401, { error: 'Please sign in again.' });
    const raw = await req.text();
    if (raw.length > 1024) return respond(413, { error: 'Request body too large.' });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return respond(400, { error: 'Invalid request.' }); }
    if (!body || typeof body !== 'object' || !('adult_confirmed' in body) || body.adult_confirmed !== true) {
      return respond(400, { error: 'Confirm that you are at least 18 years old.' });
    }
    if (data.user.app_metadata?.cheffo_adult_confirmed === true) return respond(200, { confirmed: true });
    const { data: updated, error: updateError } = await getSupabaseAdmin().auth.admin.updateUserById(data.user.id, {
      app_metadata: {
        ...data.user.app_metadata,
        cheffo_adult_confirmed: true,
        cheffo_adult_confirmed_at: new Date().toISOString(),
        cheffo_adult_policy: '18-plus-v1',
      },
    });
    if (updateError || updated?.user?.app_metadata?.cheffo_adult_confirmed !== true) {
      return respond(503, { error: 'Could not save your confirmation. Please try again.' });
    }
    return respond(200, { confirmed: true });
  } catch {
    return respond(503, { error: 'Age confirmation is temporarily unavailable. Please try again.' });
  }
}
