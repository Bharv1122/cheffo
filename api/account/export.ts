// POST /api/account/export — bundle every row the user owns into a single JSON
// file they can download. Required by GDPR/CCPA-style data-portability rules and
// expected by app-store reviewers alongside in-app account deletion. (CHE-42)
//
// Auth: Authorization: Bearer <supabase access token>. Reads go through a
// user-scoped client so RLS is the source of truth — even if a future bug let
// this endpoint be called from another user's token, they'd only see their own
// rows.

import { getUserClient } from '../_lib/supabaseAdmin';

export const config = { runtime: 'edge' };

function jsonResponse(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) return jsonResponse(401, { error: 'Sign in to export your data.' });

  const userClient = getUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse(401, { error: 'Your session has expired — please sign in again.' });

  const user = userData.user;

  // All user-owned tables read in parallel. RLS scopes each query to the
  // calling user, so even if a column filter were missing here we'd still only
  // see this user's rows.
  const [profiles, recipes, preferences, approvals, llmUsage] = await Promise.all([
    userClient.from('dog_profiles').select('*'),
    userClient.from('saved_recipes').select('*'),
    userClient.from('user_preferences').select('*'),
    userClient.from('approvals').select('*'),
    userClient.from('llm_usage').select('*'),
  ]);

  const bundle = {
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
    },
    dogProfiles: profiles.data ?? [],
    savedRecipes: recipes.data ?? [],
    userPreferences: preferences.data ?? [],
    approvals: approvals.data ?? [],
    llmUsage: llmUsage.data ?? [],
    errors: [profiles.error, recipes.error, preferences.error, approvals.error, llmUsage.error]
      .filter((e): e is Exclude<typeof e, null> => Boolean(e))
      .map(e => ({ message: e.message, code: e.code })),
  };

  const filename = `cheffo-doggo-data-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
