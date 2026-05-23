// Per-dog suggested supplement dosing for the vet-approval form (CHE-116).
//
// Each supplement's educational range in `src/data/supplements.ts` describes a
// dose-per-something formula (mg/lb of food, mg/kg of body weight, etc.).
// Here we apply that formula with the actual dog + recipe data and emit a
// rounded suggestion the vet can sign off on or edit. These are starting
// points — the vet's submitted dose is the source of truth.

import type { Recipe } from '../types/recipe';

export interface SuggestedDose {
  supplementName: string;
  suggestion: string | null;
  rationale: string | null;
  // True when `suggestion` is computed from a weight/food formula (calcium,
  // omega-3, joint). False when it's a label-based hint that just adds the
  // dog's weight as context (multivitamin, probiotic — products vary). The
  // UI uses this to decide whether to show the suggestion by default
  // (formula-backed) or only after the user opts in by checking the box
  // (label-based). (CHE-123)
  byFormula: boolean;
}

const GRAMS_PER_LB = 453.592;
const KG_PER_LB = 0.4535924;

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function computeSuggestedDoses(args: {
  recipe: Pick<Recipe, 'supplements' | 'serving'>;
  dogWeightLbs: number;
}): SuggestedDose[] {
  const dailyFoodGrams = args.recipe.serving?.totalDailyGrams ?? 0;
  const dailyFoodLbs = dailyFoodGrams / GRAMS_PER_LB;
  const weightLbs = args.dogWeightLbs > 0 ? args.dogWeightLbs : 0;
  const weightKg = weightLbs * KG_PER_LB;

  return args.recipe.supplements.map((supplement) => {
    switch (supplement.category) {
      case 'calcium': {
        if (dailyFoodLbs <= 0) {
          return { supplementName: supplement.name, suggestion: null, rationale: null, byFormula: true };
        }
        const mg = roundToNearest(dailyFoodLbs * 1100, 50); // midpoint of 1,000–1,200 mg/lb
        return {
          supplementName: supplement.name,
          suggestion: `~${mg.toLocaleString()} mg / day`,
          rationale: `${dailyFoodLbs.toFixed(1)} lb food/day × ~1,100 mg/lb (midpoint of 1,000–1,200)`,
          byFormula: true,
        };
      }
      case 'omega3': {
        if (weightKg <= 0) {
          return { supplementName: supplement.name, suggestion: null, rationale: null, byFormula: true };
        }
        const mg = roundToNearest(weightKg * 37.5, 25); // midpoint of 20–55 mg EPA+DHA/kg
        return {
          supplementName: supplement.name,
          suggestion: `~${mg.toLocaleString()} mg EPA+DHA / day`,
          rationale: `${weightKg.toFixed(1)} kg body weight × ~37.5 mg/kg (midpoint of 20–55)`,
          byFormula: true,
        };
      }
      case 'joint': {
        if (weightLbs <= 0) {
          return { supplementName: supplement.name, suggestion: null, rationale: null, byFormula: true };
        }
        // ~15 mg/lb, floored at 500 mg/day for medium dogs.
        const mg = Math.max(500, roundToNearest(weightLbs * 15, 50));
        return {
          supplementName: supplement.name,
          suggestion: `~${mg.toLocaleString()} mg glucosamine / day`,
          rationale: `~15 mg/lb × ${weightLbs} lb (minimum 500 mg/day)`,
          byFormula: true,
        };
      }
      // Multivitamin and probiotic don't have a clean mg/weight formula —
      // products vary wildly. We still emit a starting-point suggestion that
      // anchors to the dog's weight so checking the box surfaces a usable
      // dose hint instead of just "follow product label." (CHE-123)
      case 'multivitamin': {
        const weightHint = weightLbs > 0 ? `sized for a ${weightLbs}-lb dog` : 'per the product label';
        return {
          supplementName: supplement.name,
          suggestion: `1 daily dose ${weightHint}`,
          rationale: 'Most homemade-diet multivitamins are weight-scaled — follow the brand\'s dosing chart.',
          byFormula: false,
        };
      }
      case 'probiotic': {
        return {
          supplementName: supplement.name,
          suggestion: '1 daily dose per product label',
          rationale: 'Most canine probiotics are once daily regardless of body weight — check the label.',
          byFormula: false,
        };
      }
      default:
        return {
          supplementName: supplement.name,
          suggestion: null,
          rationale: 'Dose by product label — varies by brand and formulation',
          byFormula: false,
        };
    }
  });
}
