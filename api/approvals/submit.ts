// POST /api/approvals/submit — the vet submits their decision.
//
// Body: { token, decision, notes, vetName, vetPractice, vetState, signatureConfirmed }
// Public (no Authorization header) — the token IS the auth.

import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { hashToken } from '../_lib/approvalToken';
import type { ApprovalStatus } from '../../src/types/database';

export const config = { runtime: 'edge' };

interface SubmitBody {
  token?: string;
  decision?: 'approve' | 'approve_with_notes' | 'decline';
  notes?: string;
  vetName?: string;
  vetPractice?: string;
  vetState?: string;
  signatureConfirmed?: boolean;
}

const MAX_NOTES_CHARS = 500;

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
      submitted_at: new Date().toISOString(),
    })
    .eq('id', approval.id);
  if (updateError) return jsonResponse(500, { error: updateError.message });

  return jsonResponse(200, { status });
}
