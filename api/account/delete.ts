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

  // Delete data first — under RLS the user can only ever delete their own
  // rows, so even if the WHERE clauses were tampered with these are bounded.
  const deletions = await Promise.all([
    userClient.from('approvals').delete().eq('user_id', user.id),
    userClient.from('saved_recipes').delete().eq('user_id', user.id),
    userClient.from('dog_profiles').delete().eq('user_id', user.id),
    userClient.from('user_preferences').delete().eq('user_id', user.id),
  ]);
  // llm_usage is service-role-managed (no user-side DELETE policy), so we
  // wipe it via the admin client.
  const admin = getSupabaseAdmin();
  await admin.from('llm_usage').delete().eq('user_id', user.id);

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
