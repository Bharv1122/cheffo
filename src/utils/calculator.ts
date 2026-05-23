import type { DogProfile } from '../types/dog';
import type {
  ServingInfo,
  BatchInfo,
  BatchDuration,
  RecipeIngredient,
  UnitPreference,
} from '../types/recipe';

// ── RER / DER ─────────────────────────────────────────────────────────────────
// All results are ESTIMATES. Label them clearly in the UI.

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  low: 1.2,
  moderate: 1.4,
  active: 1.6,
  very_active: 1.8,
};

const LIFE_STAGE_MULTIPLIERS: Record<string, number> = {
  puppy: 3.0,   // growing dogs have much higher energy needs
  adult: 1.0,   // uses activity multiplier
  senior: 0.8,  // reduced metabolism
};

export function lbsToKg(lbs: number): number {
  return lbs * 0.453592;
}

// Resting Energy Requirement in kcal/day
export function calcRER(weightLbs: number): number {
  if (!Number.isFinite(weightLbs) || weightLbs <= 0) return 0;
  const kg = lbsToKg(weightLbs);
  return 70 * Math.pow(kg, 0.75);
}

// Daily Energy Requirement in kcal/day
export function calcDER(dog: DogProfile): number {
  const rer = calcRER(dog.weightLbs);
  if (dog.lifeStage === 'puppy') return rer * LIFE_STAGE_MULTIPLIERS.puppy;
  if (dog.lifeStage === 'senior') return rer * LIFE_STAGE_MULTIPLIERS.senior;
  return rer * (ACTIVITY_MULTIPLIERS[dog.activityLevel] ?? 1.4);
}

// Convert daily calories to grams of food
// kcalPerGram varies by recipe fat content; 1.1 is a reasonable average for balanced homemade
export function calsToGrams(calories: number, kcalPerGram = 1.1): number {
  if (!Number.isFinite(calories) || calories <= 0) return 0;
  if (!Number.isFinite(kcalPerGram) || kcalPerGram <= 0) return 0;
  return Math.round(calories / kcalPerGram);
}

// ── Serving info ──────────────────────────────────────────────────────────────
export function calcServing(dog: DogProfile, kcalPerGram = 1.1): ServingInfo {
  const dailyCals = calcDER(dog);
  const dailyGrams = calsToGrams(dailyCals, kcalPerGram);
  const gramsPerMeal = Math.round(dailyGrams / dog.mealsPerDay);
  const cupsPerMeal = Math.round((gramsPerMeal / 240) * 10) / 10; // rough ~240g per cup

  return {
    gramsPerMeal,
    cupsPerMeal,
    mealsPerDay: dog.mealsPerDay,
    totalDailyGrams: dailyGrams,
  };
}

// ── Batch info ────────────────────────────────────────────────────────────────
// Accepts either the BatchDuration enum (legacy callers) or an arbitrary day
// count (Recipe Detail's custom batch input). Generalizes the previous
// 7-day-only fridge/freezer split. (CHE-batch-custom)
export function calcBatch(serving: ServingInfo, durationOrDays: BatchDuration | number): BatchInfo {
  const days = typeof durationOrDays === 'number'
    ? Math.max(1, Math.min(60, Math.round(durationOrDays)))
    : durationOrDays === '1day' ? 1 : durationOrDays === '3day' ? 3 : 7;

  const totalYieldGrams = serving.totalDailyGrams * days;
  const totalMeals = serving.mealsPerDay * days;
  const numberOfContainers = days;

  // Keep up to 3 days in the fridge; freeze the rest.
  const fridgeDays = Math.min(3, days);
  const freezerDays = Math.max(0, days - 3);
  const fridgeMeals = serving.mealsPerDay * fridgeDays;
  const freezerMeals = serving.mealsPerDay * freezerDays;

  return {
    totalYieldGrams,
    numberOfMeals: totalMeals,
    numberOfContainers,
    fridgeMeals,
    freezerMeals,
    usedFor: `${days}day`,
  };
}

// ── Ingredient amounts from proportions ───────────────────────────────────────
export interface IngredientAmounts {
  proteinGrams: number;
  carbGrams: number;
  vegGrams: number;
  fatGrams: number;
}

// Rough macronutrient split by weight for a balanced homemade recipe
export function splitIngredients(totalGrams: number): IngredientAmounts {
  return {
    proteinGrams: Math.round(totalGrams * 0.40),
    carbGrams: Math.round(totalGrams * 0.30),
    vegGrams: Math.round(totalGrams * 0.20),
    fatGrams: Math.round(totalGrams * 0.10),
  };
}

// ── Unit helpers ───────────────────────────────────────────────────────────────
const ML_PER_CUP = 240;
const TBSP_PER_CUP = 16;
const TSP_PER_CUP = 48;

export function gramsToOz(grams: number): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;

  const rawOz = grams / 28.35;
  if (rawOz < 0.1) {
    return Number(rawOz.toFixed(2));
  }

  return Math.round(rawOz * 10) / 10;
}

export function gramsToLbs(grams: number): number {
  return Math.round((grams / 453.592) * 10) / 10;
}

// Rough cups conversion (varies by ingredient density)
export function gramsToCups(grams: number): number {
  return Math.round((grams / ML_PER_CUP) * 4) / 4; // round to nearest ¼ cup
}

export function cupsToMl(cups: number): number {
  if (!Number.isFinite(cups) || cups <= 0) return 0;
  return Math.max(1, Math.round(cups * ML_PER_CUP));
}

function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

function formatFractional(value: number, unit: string): string {
  const rounded = roundToQuarter(value);
  const whole = Math.floor(rounded);
  const fraction = Number((rounded - whole).toFixed(2));

  const fractionMap: Record<number, string> = {
    0.25: '¼',
    0.5: '½',
    0.75: '¾',
  };

  // Singular for anything up to one unit ("¼ cup", "1 cup"); plural beyond.
  const suffix = rounded <= 1 ? unit : `${unit}s`;

  if (!whole && fractionMap[fraction]) return `${fractionMap[fraction]} ${suffix}`;
  if (!fraction) return `${whole} ${suffix}`;

  return `${whole} ${fractionMap[fraction] ?? fraction.toString()} ${suffix}`;
}

export function formatVolumeAmountFromCups(cups: number): string {
  if (!Number.isFinite(cups) || cups <= 0) return 'a small amount';

  if (cups >= 0.25) {
    return formatFractional(cups, 'cup');
  }

  const tablespoons = cups * TBSP_PER_CUP;
  if (tablespoons >= 0.5) {
    return formatFractional(tablespoons, 'tbsp');
  }

  const teaspoons = Math.max(0.25, roundToQuarter(cups * TSP_PER_CUP));
  return formatFractional(teaspoons, 'tsp');
}

export function formatImperialWeight(grams: number): string {
  const lbs = grams / 453.592;
  const oz = grams / 28.35;

  if (lbs >= 1.8) return `${Math.round(lbs)} lbs`;
  if (lbs >= 0.9) return '1 lb';
  if (lbs >= 0.4) return '½ lb';
  if (oz >= 1) return `${Math.round(oz)} oz`;
  return `${Math.max(1, Math.round(grams))} g`;
}

function looksLikeLiquid(ingredient: Pick<RecipeIngredient, 'name' | 'category'>): boolean {
  const label = ingredient.name.toLowerCase();
  return ingredient.category === 'fat' || ingredient.category === 'supplement' || label.includes('oil') || label.includes('water');
}

export function formatMetricIngredient(ingredient: Pick<RecipeIngredient, 'name' | 'amountGrams' | 'amountCups' | 'amountMl' | 'category'>): string {
  const fallbackMl = ingredient.amountCups ? cupsToMl(ingredient.amountCups) : 0;
  const ml = ingredient.amountMl ?? fallbackMl;

  if (looksLikeLiquid(ingredient) && ml > 0) {
    return `${ml}ml ${ingredient.name}`;
  }

  return `${Math.max(1, Math.round(ingredient.amountGrams))}g ${ingredient.name}`;
}

export function formatVolumeIngredient(ingredient: Pick<RecipeIngredient, 'name' | 'amountGrams' | 'amountCups' | 'category'>): string {
  const cups = ingredient.amountCups ?? gramsToCups(ingredient.amountGrams);
  const volume = formatVolumeAmountFromCups(cups);

  if (ingredient.category === 'protein' || ingredient.category === 'supplement') {
    const weight = formatImperialWeight(ingredient.amountGrams);
    return `${weight} ${ingredient.name} (about ${volume})`;
  }

  return `${volume} ${ingredient.name}`;
}

export function formatIngredientByPreference(
  ingredient: Pick<RecipeIngredient, 'name' | 'amountGrams' | 'amountCups' | 'amountMl' | 'category' | 'displayMetric' | 'displayVolume'>,
  unitPreference: UnitPreference
): string {
  if (unitPreference === 'metric') {
    return ingredient.displayMetric ?? formatMetricIngredient(ingredient);
  }

  return ingredient.displayVolume ?? formatVolumeIngredient(ingredient);
}

// Grocery-friendly legacy label (kept for backward compatibility)
export function groceryLabel(grams: number, ingredientName: string): string {
  const lbs = grams / 453.592;
  const oz = grams / 28.35;

  if (lbs >= 1.8) return `about ${Math.round(lbs)} lbs ${ingredientName}`;
  if (lbs >= 0.9) return `about 1 lb ${ingredientName}`;
  if (lbs >= 0.4) return `about ½ lb ${ingredientName}`;
  if (oz >= 10) return `about ${Math.round(oz)} oz ${ingredientName}`;
  return `about ${Math.round(grams)}g ${ingredientName}`;
}
