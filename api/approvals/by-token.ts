// GET /api/approvals/by-token?token=...
//
// Public route used by the vet's approval form to load everything they need
// in one shot: recipe snapshot, dog basics, and (if we've seen this vet
// before) their previously submitted name/practice/state for prefill.

import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { hashToken } from '../_lib/approvalToken';
import { checkIpRateLimit, tooManyRequestsResponse } from '../_lib/rateLimit';

export const config = { runtime: 'edge' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

  const rateLimit = await checkIpRateLimit(req, 'approvals_by_token');
  if (!rateLimit.allowed) return tooManyRequestsResponse(rateLimit);

  const url = new URL(req.url);
  const token = url.searchParams.get('token')?.trim();
  if (!token) return jsonResponse(400, { error: 'token query param is required' });

  const tokenHashHex = await hashToken(token);

  const admin = getSupabaseAdmin();
  const { data: approval, error: approvalError } = await admin
    .from('approvals')
    .select('*')
    .eq('token_hash', tokenHashHex)
    .single();
  if (approvalError || !approval) return jsonResponse(404, { error: 'Approval link not found' });

  const now = Date.now();
  const expired = new Date(approval.token_expires_at).getTime() < now;

  const { data: dog } = await admin
    .from('dog_profiles')
    .select(
      'name, breed, age_years, age_months, weight_lbs, life_stage, activity_level, allergies, medications, avoid_foods'
    )
    .eq('id', approval.dog_profile_id)
    .single();

  let vetPrefill: { name: string | null; practice: string | null; state: string | null } | null = null;
  if (approval.status === 'pending') {
    const { data: priorVet } = await admin
      .from('approvals')
      .select('vet_name, vet_practice, vet_state')
      .eq('vet_email', approval.vet_email)
      // Scope to THIS owner's prior approvals — the prefill is a convenience for
      // a vet who reviews repeatedly for the same user. Without this, any user
      // could surface another customer's vet's name/practice/state by putting
      // that vet's email on their own request (service-role = no RLS backstop).
      .eq('user_id', approval.user_id)
      .not('vet_name', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorVet) {
      vetPrefill = { name: priorVet.vet_name, practice: priorVet.vet_practice, state: priorVet.vet_state };
    }
  }

  return jsonResponse(200, {
    approval: {
      id: approval.id,
      status: expired && approval.status === 'pending' ? 'expired' : approval.status,
      submittedAt: approval.submitted_at,
      notes: approval.notes,
      vetName: approval.vet_name,
      vetPractice: approval.vet_practice,
      vetState: approval.vet_state,
      tokenExpired: expired,
    },
    dog,
    recipe: approval.recipe_snapshot,
    vetPrefill,
  });
}
