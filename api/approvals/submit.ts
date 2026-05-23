// POST /api/approvals/submit — the vet submits their decision.
//
// Body: { token, decision, notes, vetName, vetPractice, vetState, signatureConfirmed }
// Public (no Authorization header) — the token IS the auth.

import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { hashToken } from '../_lib/approvalToken';
import type { ApprovalStatus, Json } from '../../src/types/database';

export const config = { runtime: 'edge' };

interface SupplementDoseInput {
  supplementName?: unknown;
  doseText?: unknown;
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
function normalizeSupplementDoses(input: unknown): Json | null {
  if (!Array.isArray(input)) return null;
  const cleaned: Array<{ supplementName: string; doseText: string }> = [];
  for (const entry of input.slice(0, MAX_DOSE_ENTRIES)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as SupplementDoseInput;
    const name = typeof e.supplementName === 'string' ? e.supplementName.trim() : '';
    const dose = typeof e.doseText === 'string' ? e.doseText.trim().slice(0, MAX_DOSE_TEXT_CHARS) : '';
    if (!name || !dose) continue;
    cleaned.push({ supplementName: name, doseText: dose });
  }
  return cleaned.length > 0 ? (cleaned as unknown as Json) : null;
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
      supplement_doses: supplementDoses,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', approval.id);
  if (updateError) return jsonResponse(500, { error: updateError.message });

  return jsonResponse(200, { status });
}
