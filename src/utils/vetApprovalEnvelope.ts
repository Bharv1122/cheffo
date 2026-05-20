// Re-approval delta logic for distributed vet approvals (CHE-21).
//
// A vet approves a *recipe template + ingredient envelope*, not a one-off.
// When a user regenerates a similar recipe, we check whether the new variant
// falls inside the prior approval's tolerance. Inside tolerance → auto-inherit
// the badge (no new email to the vet). Outside → request a fresh approval.
//
// Tolerance per strategy memo (2026-05-20):
//   ±10% kcal/day · ±15% total protein grams · same primary protein
//   · no new ingredient · approval not expired (annual + weight-delta-15%)

import type { Recipe } from '../types/recipe';

export interface NutritionEnvelope {
  kcalPerDay: number;
  proteinGrams: number;
  primaryProteinId: string;
  ingredientIds: string[];
}

export function buildEnvelope(recipe: Recipe): NutritionEnvelope {
  const proteinIngredients = recipe.ingredients.filter(ingredient => ingredient.category === 'protein');
  const proteinGrams = proteinIngredients.reduce((sum, ingredient) => sum + ingredient.amountGrams, 0);
  const primary = [...proteinIngredients].sort((a, b) => b.amountGrams - a.amountGrams)[0];

  return {
    kcalPerDay: Math.round(recipe.nutrition.caloriesPerDay),
    proteinGrams: Math.round(proteinGrams * 10) / 10,
    primaryProteinId: primary?.ingredientId ?? '',
    ingredientIds: [...new Set(recipe.ingredients.map(ingredient => ingredient.ingredientId))].sort(),
  };
}

export interface DeltaCheckOptions {
  kcalTolerance?: number;
  proteinTolerance?: number;
}

export interface DeltaResult {
  withinTolerance: boolean;
  reasons: string[];
}

export function compareEnvelopes(
  prior: NutritionEnvelope,
  next: NutritionEnvelope,
  options: DeltaCheckOptions = {}
): DeltaResult {
  const kcalTolerance = options.kcalTolerance ?? 0.10;
  const proteinTolerance = options.proteinTolerance ?? 0.15;
  const reasons: string[] = [];

  if (prior.primaryProteinId !== next.primaryProteinId) {
    reasons.push(
      `Primary protein changed (${prior.primaryProteinId || 'unknown'} → ${next.primaryProteinId || 'unknown'})`
    );
  }

  const kcalDelta = prior.kcalPerDay > 0 ? Math.abs(next.kcalPerDay - prior.kcalPerDay) / prior.kcalPerDay : 1;
  if (kcalDelta > kcalTolerance) {
    reasons.push(`Daily calories changed by ${Math.round(kcalDelta * 100)}% (limit ${Math.round(kcalTolerance * 100)}%)`);
  }

  const proteinDelta =
    prior.proteinGrams > 0 ? Math.abs(next.proteinGrams - prior.proteinGrams) / prior.proteinGrams : 1;
  if (proteinDelta > proteinTolerance) {
    reasons.push(
      `Protein content changed by ${Math.round(proteinDelta * 100)}% (limit ${Math.round(proteinTolerance * 100)}%)`
    );
  }

  const priorSet = new Set(prior.ingredientIds);
  const newIngredients = next.ingredientIds.filter(id => !priorSet.has(id));
  if (newIngredients.length > 0) {
    reasons.push(`New ingredients added (${newIngredients.join(', ')})`);
  }

  return { withinTolerance: reasons.length === 0, reasons };
}

// Approvals expire annually, or when a dog's weight has shifted >15% since the
// recipe was originally approved. Caller passes the dog's weight at approval
// time and the dog's current weight.
export function isApprovalExpired(
  approvedAtIso: string,
  approvedWeightLbs: number,
  currentWeightLbs: number,
  maxAgeDays = 365,
  weightTolerance = 0.15
): boolean {
  const ageMs = Date.now() - new Date(approvedAtIso).getTime();
  if (ageMs > maxAgeDays * 24 * 60 * 60 * 1000) return true;
  if (approvedWeightLbs <= 0) return false;
  const weightDelta = Math.abs(currentWeightLbs - approvedWeightLbs) / approvedWeightLbs;
  return weightDelta > weightTolerance;
}
