// Client-side helpers for the distributed vet-approval flow (CHE-21).
//
// The user-side reads (list approvals for a recipe) hit Supabase directly so
// RLS scopes them automatically. Writes and the public vet form go through
// /api/approvals/* — those routes use the service-role key server-side.

import { isSupabaseConfigured, supabase } from './supabase';
import type { ApprovalRow, ApprovalStatus } from '../types/database';

export interface VetSupplementDose {
  supplementName: string;
  doseText: string;
}

// A vet-suggested ingredient on the approval form. ingredientId is set when
// the vet picked from the catalog dropdown; undefined means "Other..." (vet
// typed a free-form name). amountGrams must be > 0. (CHE-126)
export interface VetIngredientEdit {
  ingredientId?: string;
  name: string;
  amountGrams: number;
  category: 'protein' | 'carb' | 'vegetable' | 'fat' | 'supplement' | 'treat';
  prepNote?: string;
}

export interface ApprovalSummary {
  id: string;
  recipeId: string;
  status: ApprovalStatus;
  vetEmail: string;
  vetName: string | null;
  vetPractice: string | null;
  vetState: string | null;
  notes: string | null;
  supplementDoses: VetSupplementDose[] | null;
  // True when the vet's submission included ingredient edits that were
  // applied to the recipe — drives the "Updated by Dr. X DVM" indicator
  // on the family side. (CHE-126)
  recipeUpdatedByVet: boolean;
  submittedAt: string | null;
  createdAt: string;
}

function parseSupplementDoses(value: unknown): VetSupplementDose[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned: VetSupplementDose[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.supplementName === 'string' ? e.supplementName.trim() : '';
    const dose = typeof e.doseText === 'string' ? e.doseText.trim() : '';
    if (name && dose) cleaned.push({ supplementName: name, doseText: dose });
  }
  return cleaned.length > 0 ? cleaned : null;
}

function toApprovalSummary(row: ApprovalRow): ApprovalSummary {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    status: row.status,
    vetEmail: row.vet_email,
    vetName: row.vet_name,
    vetPractice: row.vet_practice,
    vetState: row.vet_state,
    notes: row.notes,
    supplementDoses: parseSupplementDoses(row.supplement_doses),
    recipeUpdatedByVet: row.recipe_updated_by_vet ?? false,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
  };
}

export async function listApprovalsForRecipe(recipeId: string): Promise<ApprovalSummary[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toApprovalSummary);
}

// Fetch every approval belonging to the current user. RLS scopes the result
// to the signed-in user's rows. Used by useApprovals() so the Recipes tab,
// Recipe Detail badge, and Home banner share a single fetch. (CHE-124)
export async function listAllUserApprovals(): Promise<ApprovalSummary[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .order('submitted_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toApprovalSummary);
}

export interface RequestApprovalResult {
  status: 'pending' | 'auto_inherited';
  approvalId?: string;
  approvalLink?: string;
  inheritedFromApprovalId?: string;
  approvedBy?: { name: string | null; practice: string | null; state: string | null };
  submittedAt?: string;
  email?: { sent: boolean; reason?: string };
}

export async function requestVetApproval(args: { recipeId: string; vetEmail: string }): Promise<RequestApprovalResult> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Vet approval requires Supabase to be configured');
  }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session) {
    throw new Error('You must be signed in to request a vet approval');
  }
  const accessToken = sessionData.session.access_token;

  const response = await fetch('/api/approvals/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(args),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? `Request failed (${response.status})`);
  }
  return body as RequestApprovalResult;
}

export interface PublicApprovalView {
  approval: {
    id: string;
    status: ApprovalStatus;
    submittedAt: string | null;
    notes: string | null;
    vetName: string | null;
    vetPractice: string | null;
    vetState: string | null;
    tokenExpired: boolean;
  };
  dog: {
    name: string;
    breed: string;
    age_years: number;
    age_months: number;
    weight_lbs: number;
    life_stage: string;
    activity_level: string;
    allergies: string[];
    medications: string[];
    avoid_foods: string[];
  } | null;
  recipe: unknown;
  vetPrefill: { name: string | null; practice: string | null; state: string | null } | null;
}

export async function fetchApprovalByToken(token: string): Promise<PublicApprovalView> {
  const response = await fetch(`/api/approvals/by-token?token=${encodeURIComponent(token)}`, {
    headers: { Accept: 'application/json' },
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    // In `vite dev`, /api/* falls through to the SPA index.html with status
    // 200 — guard against returning that HTML as a "successful" response.
    throw new Error('Approval API is not available in this environment.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? `Request failed (${response.status})`);
  }
  if (!body || typeof body !== 'object' || !('approval' in body)) {
    throw new Error('Approval API returned an unexpected response.');
  }
  return body as PublicApprovalView;
}

export interface SubmitApprovalArgs {
  token: string;
  decision: 'approve' | 'approve_with_notes' | 'decline';
  notes?: string;
  vetName: string;
  vetPractice?: string;
  vetState?: string;
  signatureConfirmed: boolean;
  supplementDoses?: VetSupplementDose[];
  // Final ingredient list after the vet's edits. Omit (or send null) when the
  // vet didn't change the ingredients — the recipe stays as-is. Ignored on
  // decline. (CHE-126)
  ingredientEdits?: VetIngredientEdit[];
}

export async function submitVetApproval(args: SubmitApprovalArgs): Promise<{ status: ApprovalStatus }> {
  const response = await fetch('/api/approvals/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? `Request failed (${response.status})`);
  }
  return body as { status: ApprovalStatus };
}
