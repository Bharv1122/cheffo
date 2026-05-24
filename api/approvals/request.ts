// POST /api/approvals/request — user asks their vet to review a recipe.
//
// Body: { recipeId, vetEmail }
// Auth: Authorization: Bearer <supabase access token>
//
// Looks up the saved recipe + dog profile via a user-scoped client (so RLS
// still applies — a malicious user can't request approval for someone else's
// recipe). Generates an opaque token, stores its SHA-256 in `approvals`, and
// sends the vet an email with the approval link via Resend (if configured).
//
// Re-approval delta: if the user already has an approval for this dog within
// the recipe's nutritional envelope, we return it and skip the new request.

import { getSupabaseAdmin, getUserClient } from '../_lib/supabaseAdmin';
import { approvalLink, generateToken, hashToken, tokenExpiresAt } from '../_lib/approvalToken';
import { buildEnvelope, compareEnvelopes, type NutritionEnvelope } from '../../src/utils/vetApprovalEnvelope';
import type { Recipe } from '../../src/types/recipe';
import type { ApprovalRow, Json } from '../../src/types/database';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

interface RequestBody {
  recipeId?: string;
  vetEmail?: string;
  // Optional: subset of supplement names to include in the snapshot the vet
  // sees. Undefined / empty / unknown values default to "send all supplements"
  // (existing behavior). Required supplements (isRequired: true) are always
  // included regardless of what's listed. (CHE-127)
  supplementNames?: unknown;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendApprovalEmail(args: {
  vetEmail: string;
  dogName: string;
  recipeName: string;
  link: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM ?? 'Cheffo <vet-approvals@cheffodoggo.com>';
  if (!apiKey) {
    console.warn(`[approvals] RESEND_API_KEY missing — approval link for ${args.vetEmail}: ${args.link}`);
    return { sent: false, reason: 'resend_not_configured' };
  }
  const subject = `Recipe review request for ${args.dogName} — ~60 seconds`;
  const text = [
    `Hi,`,
    ``,
    `Your patient's parent uses Cheffo to plan ${args.dogName}'s home-cooked meals and asked for your sign-off on a recipe.`,
    ``,
    `Review the recipe and approve, approve with notes, or decline:`,
    `${args.link}`,
    ``,
    `This typically takes ~60 seconds. Your standard consultation fee may apply — please let your client know in advance.`,
    ``,
    `— Cheffo`,
  ].join('\n');

  const upstream = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: fromAddress, to: [args.vetEmail], subject, text }),
  });
  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    console.error(`[approvals] Resend send failed (${upstream.status}): ${errText}`);
    return { sent: false, reason: `resend_${upstream.status}` };
  }
  return { sent: true };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const auth = req.headers.get('authorization');
  const accessToken = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null;
  if (!accessToken) return jsonResponse(401, { error: 'Missing access token' });

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  const recipeId = body.recipeId?.trim();
  const vetEmail = body.vetEmail?.trim().toLowerCase();
  if (!recipeId) return jsonResponse(400, { error: 'recipeId is required' });
  if (!vetEmail || !isValidEmail(vetEmail)) return jsonResponse(400, { error: 'Valid vet email is required' });

  const userClient = getUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return jsonResponse(401, { error: 'Invalid access token' });
  const userId = userData.user.id;

  const { data: recipeRow, error: recipeError } = await userClient
    .from('saved_recipes')
    .select('*')
    .eq('id', recipeId)
    .single();
  if (recipeError || !recipeRow) return jsonResponse(404, { error: 'Recipe not found' });

  const recipe = recipeRow.recipe_data as unknown as Recipe;

  // Filter supplements to the user's chosen subset (plus required ones, which
  // are always included). If supplementNames is missing/invalid we leave the
  // recipe alone — backwards compatible with older clients. (CHE-127)
  const includedNames = Array.isArray(body.supplementNames)
    ? new Set(
        body.supplementNames
          .filter((n): n is string => typeof n === 'string')
          .map((n) => n.toLowerCase())
      )
    : null;
  const filteredRecipeForSnapshot: Recipe =
    includedNames && recipe.supplements && recipe.supplements.length > 0
      ? {
          ...recipe,
          supplements: recipe.supplements.filter(
            (s) => s.isRequired || includedNames.has(s.name.toLowerCase())
          ),
        }
      : recipe;
  const envelope = buildEnvelope(filteredRecipeForSnapshot);

  const admin = getSupabaseAdmin();
  const { data: priorApprovals } = await admin
    .from('approvals')
    .select('*')
    .eq('user_id', userId)
    .eq('dog_profile_id', recipeRow.dog_profile_id)
    .eq('vet_email', vetEmail)
    .in('status', ['approved', 'approved_with_notes'])
    .order('submitted_at', { ascending: false })
    .limit(5);

  if (priorApprovals && priorApprovals.length > 0) {
    for (const prior of priorApprovals as ApprovalRow[]) {
      const priorEnvelope = prior.nutrition_envelope as unknown as NutritionEnvelope;
      if (compareEnvelopes(priorEnvelope, envelope).withinTolerance) {
        return jsonResponse(200, {
          status: 'auto_inherited',
          inheritedFromApprovalId: prior.id,
          approvedBy: { name: prior.vet_name, practice: prior.vet_practice, state: prior.vet_state },
          submittedAt: prior.submitted_at,
        });
      }
    }
  }

  const rawToken = generateToken();
  const tokenHashHex = await hashToken(rawToken);
  const expiresAt = tokenExpiresAt();

  const { data: inserted, error: insertError } = await admin
    .from('approvals')
    .insert({
      user_id: userId,
      recipe_id: recipeRow.id,
      dog_profile_id: recipeRow.dog_profile_id,
      recipe_snapshot: filteredRecipeForSnapshot as unknown as Json,
      nutrition_envelope: envelope as unknown as Json,
      vet_email: vetEmail,
      token_hash: tokenHashHex,
      token_expires_at: expiresAt,
      status: 'pending',
    })
    .select('*')
    .single();
  if (insertError || !inserted) {
    return jsonResponse(500, { error: insertError?.message ?? 'Could not create approval request' });
  }

  const url = new URL(req.url);
  const origin = process.env.PUBLIC_APP_ORIGIN ?? `${url.protocol}//${url.host}`;
  const link = approvalLink(origin, rawToken);

  const { data: dogRow } = await admin
    .from('dog_profiles')
    .select('name')
    .eq('id', recipeRow.dog_profile_id)
    .single();

  const emailResult = await sendApprovalEmail({
    vetEmail,
    dogName: dogRow?.name ?? 'your patient',
    recipeName: recipeRow.name,
    link,
  });

  return jsonResponse(200, {
    status: 'pending',
    approvalId: inserted.id,
    approvalLink: link,
    email: emailResult,
  });
}
