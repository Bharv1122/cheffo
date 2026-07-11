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

// Approximate prepared weight per US cup (grams), by ingredient ID. Falls back
// to water density (ML_PER_CUP = 240 g/cup) for anything not listed.
//
// The physical form (dry vs cooked, raw vs chopped) is inferred from each
// ingredient's caloriesPerGram in ingredients.ts, so the density matches the
// state the recipe actually uses:
//   • oats are DRY (3.89 kcal/g) → light, ~90 g/cup
//   • rice / barley / quinoa / millet are COOKED (~1.1–1.3 kcal/g) → ~160–190 g/cup
//   • veg & fruit are RAW / CHOPPED (kcal matches raw USDA values) → ~30–170 g/cup
// Previously gramsToCups assumed 1 g = 1 ml for everything, so dry/light
// ingredients (notably oats) displayed ~2–3× too little volume in US units.
// REVIEW-REQUIRED: chef can fine-tune these cup weights.
const GRAMS_PER_CUP_BY_ID: Record<string, number> = {
  // Carbs
  oats: 90, // dry rolled oats
  white_rice: 160, // cooked
  brown_rice: 190, // cooked
  barley: 157, // cooked
  quinoa: 185, // cooked
  millet: 174, // cooked
  butternut_squash: 205, // cooked, cubed
  acorn_squash: 205, // cooked, cubed
  // pumpkin (puree ~245) and sweet_potato (mashed ~245) ≈ water → use default
  // Vegetables (raw, chopped)
  carrots: 128,
  green_beans: 125,
  zucchini: 124,
  peas: 145,
  broccoli: 91,
  spinach: 30, // raw leaves are very light
  kale: 67,
  cucumber: 133,
  cabbage: 89, // shredded
  brussels_sprouts: 88, // halved
  beets_cooked: 170,
  parsnip: 133,
  blueberries: 148,
  // Fruit / treat produce
  banana: 150, // sliced
  apple: 125, // chopped
  strawberries: 166, // sliced
  watermelon: 152, // cubed
  pear: 160, // chopped
  // Seeds (ground)
  flaxseed_ground: 130,
  chia_seeds: 170,
  // Proteins — diced/cubed raw muscle meats ~140-150 g/cup, ground meats
  // ~225 g/cup (packed), matching the raw prep state the recipes use.
  // REVIEW-REQUIRED: chef can fine-tune these cup weights.
  chicken_breast: 140,
  turkey_breast: 140,
  duck_breast: 140,
  pork_loin: 140,
  lamb: 150,
  venison: 150,
  salmon: 150,
  whitefish: 145,
  sardines_canned: 150,
  mackerel_canned: 150,
  chicken_liver: 150,
  beef_liver: 150,
  ground_turkey: 225,
  ground_beef_lean: 225,
  ground_chicken: 225,
  cottage_cheese: 226, // USDA: 1 cup = 226 g
  eggs: 243, // beaten whole egg; display uses egg COUNT, cups are the fallback
  // Oils (~0.91-0.92 g/ml) and powders
  olive_oil: 216,
  coconut_oil: 218,
  salmon_oil: 208,
  eggshell_powder: 264, // ~5.5 g/tsp
};

// One large egg without shell ≈ 50 g — used to display eggs as a count.
const GRAMS_PER_LARGE_EGG = 50;

export function gramsPerCupFor(ingredientId?: string | null): number {
  if (ingredientId && GRAMS_PER_CUP_BY_ID[ingredientId] != null) {
    return GRAMS_PER_CUP_BY_ID[ingredientId];
  }
  return ML_PER_CUP;
}

// Cups conversion that accounts for ingredient density. Pass the per-ingredient
// grams-per-cup (via gramsPerCupFor) so dry/light ingredients convert correctly;
// omitting it falls back to water density for backward compatibility.
export function gramsToCups(grams: number, gramsPerCup: number = ML_PER_CUP): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  return Math.round((grams / gramsPerCup) * 4) / 4; // round to nearest ¼ cup
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
  if (lbs >= 0.65) return '¾ lb';
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
  const lowerName = ingredient.name.toLowerCase();

  // Eggs are counted, not measured ("2 eggs", not "½ cup eggs").
  if (lowerName.includes('egg') && !lowerName.includes('eggshell')) {
    const count = Math.max(0.5, Math.round((ingredient.amountGrams / GRAMS_PER_LARGE_EGG) * 2) / 2);
    const noun = count <= 1 ? 'egg' : 'eggs';
    const countLabel = Number.isInteger(count) ? String(count) : count === 0.5 ? '½' : `${Math.floor(count)}½`;
    return `${countLabel} ${noun}`;
  }

  // Unrounded cups here — formatVolumeAmountFromCups picks the right unit
  // and rounds there. gramsToCups' quarter-cup rounding would zero out
  // tsp-scale amounts (e.g. 3 g fish oil → "a small amount").
  const cups = ingredient.amountCups || ingredient.amountGrams / ML_PER_CUP;
  const volume = formatVolumeAmountFromCups(cups);

  // Kitchen-measure first everywhere. Proteins keep the weight in parens
  // for the grocery run (meat is bought by the pound, measured by the cup).
  if (ingredient.category === 'protein') {
    return `${volume} ${ingredient.name} (${formatImperialWeight(ingredient.amountGrams)})`;
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
