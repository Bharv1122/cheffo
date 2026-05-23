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
          return { supplementName: supplement.name, suggestion: null, rationale: null };
        }
        const mg = roundToNearest(dailyFoodLbs * 1100, 50); // midpoint of 1,000–1,200 mg/lb
        return {
          supplementName: supplement.name,
          suggestion: `~${mg.toLocaleString()} mg / day`,
          rationale: `${dailyFoodLbs.toFixed(1)} lb food/day × ~1,100 mg/lb (midpoint of 1,000–1,200)`,
        };
      }
      case 'omega3': {
        if (weightKg <= 0) {
          return { supplementName: supplement.name, suggestion: null, rationale: null };
        }
        const mg = roundToNearest(weightKg * 37.5, 25); // midpoint of 20–55 mg EPA+DHA/kg
        return {
          supplementName: supplement.name,
          suggestion: `~${mg.toLocaleString()} mg EPA+DHA / day`,
          rationale: `${weightKg.toFixed(1)} kg body weight × ~37.5 mg/kg (midpoint of 20–55)`,
        };
      }
      case 'joint': {
        if (weightLbs <= 0) {
          return { supplementName: supplement.name, suggestion: null, rationale: null };
        }
        // ~15 mg/lb, floored at 500 mg/day for medium dogs.
        const mg = Math.max(500, roundToNearest(weightLbs * 15, 50));
        return {
          supplementName: supplement.name,
          suggestion: `~${mg.toLocaleString()} mg glucosamine / day`,
          rationale: `~15 mg/lb × ${weightLbs} lb (minimum 500 mg/day)`,
        };
      }
      case 'multivitamin':
      case 'probiotic':
      default:
        return {
          supplementName: supplement.name,
          suggestion: null,
          rationale: 'Dose by product label — varies by brand and formulation',
        };
    }
  });
}
