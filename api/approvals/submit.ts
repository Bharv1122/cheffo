// POST /api/approvals/submit — the vet submits their decision.
//
// Body: { token, decision, notes, vetName, vetPractice, vetState, signatureConfirmed }
// Public (no Authorization header) — the token IS the auth.

import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { hashToken } from '../_lib/approvalToken';
import type { ApprovalStatus, Json } from '../../src/types/database';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

interface SupplementDoseInput {
  supplementName?: unknown;
  doseText?: unknown;
}

interface SupplementDoseClean {
  supplementName: string;
  doseText: string;
}

interface SubmitBody {
  token?: string;
  decision?: 'approve' | 'approve_with_notes' | 'decline';
  notes?: string;
  vetName?: string;
  vetPractice?: string;
  vetState?: string;
  signatureConfirmed?: boolean;
  supplementDoses?: SupplementDoseInput[];
}

const MAX_NOTES_CHARS = 500;
const MAX_DOSE_TEXT_CHARS = 200;
const MAX_DOSE_ENTRIES = 20;

// Filter the vet's supplement-dose entries to a safe, normalized list. Drops
// entries with no name or no text (vet left it blank), trims, and caps each
// field's length. Returns null when nothing usable was sent. (CHE-116)
function normalizeSupplementDoses(input: unknown): SupplementDoseClean[] | null {
  if (!Array.isArray(input)) return null;
  const cleaned: SupplementDoseClean[] = [];
  for (const entry of input.slice(0, MAX_DOSE_ENTRIES)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as SupplementDoseInput;
    const name = typeof e.supplementName === 'string' ? e.supplementName.trim() : '';
    const dose = typeof e.doseText === 'string' ? e.doseText.trim().slice(0, MAX_DOSE_TEXT_CHARS) : '';
    if (!name || !dose) continue;
    cleaned.push({ supplementName: name, doseText: dose });
  }
  return cleaned.length > 0 ? cleaned : null;
}

// Tell the recipe's owner that the vet finished their review. Same Resend
// account/domain that the request-side email uses. Best-effort — a delivery
// failure must not roll back the approval, just log it. (CHE-124)
async function sendUserNotificationEmail(args: {
  userEmail: string;
  recipeName: string;
  dogName: string;
  vetName: string;
  status: ApprovalStatus;
  notes: string | null;
  supplementDoses: SupplementDoseClean[] | null;
  recipeUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM ?? 'Cheffo <vet-approvals@cheffodoggo.com>';
  if (!apiKey) {
    console.warn(`[approvals] RESEND_API_KEY missing — skipping user notify for ${args.userEmail}`);
    return;
  }

  let subject: string;
  let intro: string;
  if (args.status === 'approved') {
    subject = `Dr. ${args.vetName} approved your ${args.recipeName} recipe`;
    intro = `Great news — Dr. ${args.vetName} just approved your "${args.recipeName}" recipe for ${args.dogName}.`;
  } else if (args.status === 'approved_with_notes') {
    subject = `Dr. ${args.vetName} approved your ${args.recipeName} (with notes)`;
    intro = `Dr. ${args.vetName} approved your "${args.recipeName}" recipe for ${args.dogName} with a few notes to consider.`;
  } else {
    subject = `Dr. ${args.vetName} reviewed your ${args.recipeName} recipe`;
    intro = `Dr. ${args.vetName} reviewed your "${args.recipeName}" recipe for ${args.dogName} and doesn't recommend it as-is. Their reasoning is below.`;
  }

  const lines: string[] = [`Hi,`, ``, intro, ``];
  if (args.notes) {
    lines.push(`Their notes:`, `"${args.notes}"`, ``);
  }
  if (args.supplementDoses && args.supplementDoses.length > 0) {
    lines.push(`Recommended supplement doses:`);
    for (const dose of args.supplementDoses) {
      lines.push(`  • ${dose.supplementName}: ${dose.doseText}`);
    }
    lines.push(``);
  }
  lines.push(`Open the recipe in Cheffo:`, args.recipeUrl, ``, `— Cheffo`);
  const text = lines.join('\n');

  try {
    const upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: fromAddress, to: [args.userEmail], subject, text }),
    });
    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error(`[approvals] User notify failed (${upstream.status}): ${errText}`);
    }
  } catch (sendError) {
    console.error('[approvals] User notify threw:', sendError);
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function decisionToStatus(decision: SubmitBody['decision']): ApprovalStatus | null {
  switch (decision) {
    case 'approve':
      return 'approved';
    case 'approve_with_notes':
      return 'approved_with_notes';
    case 'decline':
      return 'declined';
    default:
      return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const token = body.token?.trim();
  if (!token) return jsonResponse(400, { error: 'token is required' });

  const status = decisionToStatus(body.decision);
  if (!status) return jsonResponse(400, { error: 'decision must be approve | approve_with_notes | decline' });

  const vetName = body.vetName?.trim();
  if (!vetName) return jsonResponse(400, { error: 'vetName is required' });
  if (!body.signatureConfirmed) {
    return jsonResponse(400, { error: 'You must confirm the e-signature checkbox to submit' });
  }
  const notes = body.notes?.slice(0, MAX_NOTES_CHARS) ?? null;
  if (status === 'approve_with_notes' && !notes) {
    return jsonResponse(400, { error: 'Notes are required when approving with notes' });
  }

  // Vet's per-supplement doses are only meaningful on approvals — skip them on
  // declines (the vet isn't recommending the recipe, so a dose is moot).
  const supplementDoses = status === 'declined' ? null : normalizeSupplementDoses(body.supplementDoses);

  const tokenHashHex = await hashToken(token);
  const admin = getSupabaseAdmin();
  const { data: approval, error: lookupError } = await admin
    .from('approvals')
    .select('*')
    .eq('token_hash', tokenHashHex)
    .single();
  if (lookupError || !approval) return jsonResponse(404, { error: 'Approval link not found' });

  if (approval.status !== 'pending') {
    return jsonResponse(409, { error: 'This approval has already been submitted' });
  }
  if (new Date(approval.token_expires_at).getTime() < Date.now()) {
    return jsonResponse(410, { error: 'This approval link has expired' });
  }

  const { error: updateError } = await admin
    .from('approvals')
    .update({
      status,
      notes,
      vet_name: vetName,
      vet_practice: body.vetPractice?.trim() ?? null,
      vet_state: body.vetState?.trim() ?? null,
      vet_signature_confirmed: true,
      supplement_doses: supplementDoses as unknown as Json | null,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', approval.id);
  if (updateError) return jsonResponse(500, { error: updateError.message });

  // Best-effort notification email to the recipe's owner — fire-and-forget so
  // a Resend hiccup can't block the vet's submit response. (CHE-124)
  try {
    const recipeSnapshot = (approval.recipe_snapshot ?? {}) as { name?: string };
    const recipeName = (typeof recipeSnapshot.name === 'string' && recipeSnapshot.name) || 'Your recipe';
    const url = new URL(req.url);
    const origin = process.env.PUBLIC_APP_ORIGIN ?? `${url.protocol}//${url.host}`;
    const recipeUrl = `${origin}/recipes/${approval.recipe_id}`;

    const [{ data: userLookup }, { data: dogRow }] = await Promise.all([
      admin.auth.admin.getUserById(approval.user_id),
      admin.from('dog_profiles').select('name').eq('id', approval.dog_profile_id).single(),
    ]);
    const userEmail = userLookup?.user?.email;
    if (userEmail) {
      await sendUserNotificationEmail({
        userEmail,
        recipeName,
        dogName: dogRow?.name ?? 'your dog',
        vetName,
        status,
        notes,
        supplementDoses,
        recipeUrl,
      });
    } else {
      console.warn(`[approvals] No user email found for user_id ${approval.user_id} — skipping notify`);
    }
  } catch (notifyError) {
    console.error('[approvals] Notify pipeline failed (non-fatal):', notifyError);
  }

  return jsonResponse(200, { status });
}
