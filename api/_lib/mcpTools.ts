// Pure logic behind the public Muse / MCP tools (api/mcp.ts).
//
// Every tool here is PUBLIC and user-data free: no Supabase reads, no account,
// no LLM call. Answers come only from Cheffo Doggo's existing vetted data
// (toxic-food list, ingredient safety records, the RER/DER calculator and the
// treat catalog), so an agent can never get a guessed quantity or an invented
// safety verdict out of these tools.
//
// Copy rules (enforced by scripts/verify-mcp-tools.mjs):
//   * educational guidance, not veterinary advice — every answer ends with
//     VET_LINE;
//   * no cure / prevent / heal / "treats <condition>" claims;
//   * never a quantity that isn't already in the source data.

import { TOXIC_INGREDIENTS, RISKY_PATTERNS, type ToxicEntry } from '../../src/data/toxicIngredients';
import { INGREDIENT_SAFETY, type IngredientSafetyRecord } from '../../src/data/assistantKnowledge';
import { TREAT_CATALOG, type TreatCategory } from '../../src/data/treatCatalog';
import { TREAT_TEMPLATES } from '../../src/data/recipeTemplates';
import { calcDER, calcRER, lbsToKg } from '../../src/utils/calculator';
import type { DogProfile, LifeStage, ActivityLevel } from '../../src/types/dog';

export const SITE_URL = 'https://cheffodoggo.com';
export const VET_LINE =
  'Educational info only, not veterinary advice. Check with your veterinarian before changing your dog\'s diet.';
const POISON_LINE =
  'If your dog already ate some, call your veterinarian or ASPCA Animal Poison Control (888-426-4435) now.';

export const LIMITS = {
  foodMaxChars: 80,
  weightMin: 1,
  weightMax: 250, // lb; the heaviest breeds top out well below this
  avoidMaxItems: 10,
  avoidMaxChars: 40,
  pickMax: 50,
} as const;

export const LIFE_STAGES = ['puppy', 'adult', 'senior'] as const satisfies readonly LifeStage[];
export const ACTIVITY_LEVELS = ['low', 'moderate', 'active', 'very_active'] as const satisfies readonly ActivityLevel[];
export const TREAT_CATEGORIES = ['training', 'frozen', 'birthday', 'everyday'] as const satisfies readonly TreatCategory[];

// Strip control characters and collapse whitespace so input never lands in
// output (or logs) with injected newlines or markup-looking noise.
export function cleanText(value: string, maxChars: number): string {
  return value
    .replace(/[\p{Cc}<>]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function escapeRegExp(value: string): string {
  return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Whole-word match, so "pineapple" never matches "apple" and "steak" never
// matches "tea".
function mentions(text: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`, 'i').test(text);
}

function findToxic(food: string): ToxicEntry | undefined {
  return TOXIC_INGREDIENTS.find(entry => [entry.name, ...entry.aliases].some(term => mentions(food, term)));
}

function findRecord(food: string): IngredientSafetyRecord | undefined {
  return INGREDIENT_SAFETY.find(record => [record.name, ...record.aliases].some(term => mentions(food, term)));
}

export type SafetyVerdict = 'toxic' | 'unsafe' | 'limited' | 'caution' | 'generally_safe' | 'unknown';

export interface FoodSafetyResult {
  food: string;
  verdict: SafetyVerdict;
  text: string;
}

export function checkFoodSafety(rawFood: string): FoodSafetyResult {
  const food = cleanText(rawFood, LIMITS.foodMaxChars);
  const lines: string[] = [];
  let verdict: SafetyVerdict;

  const toxic = findToxic(food);
  const record = findRecord(food);
  const risky = RISKY_PATTERNS.filter(({ pattern }) => pattern.test(food));

  if (toxic || record?.safety === 'toxic') {
    verdict = 'toxic';
    lines.push(`Do not feed: ${toxic?.name ?? record!.name} is toxic to dogs.`);
    lines.push(toxic?.reason ?? record!.why);
    if (record?.guidance) lines.push(record.guidance);
    lines.push(POISON_LINE);
  } else if (record?.safety === 'unsafe') {
    verdict = 'unsafe';
    lines.push(`Not recommended: ${record.name}.`, record.why);
    if (record.guidance) lines.push(record.guidance);
  } else if (record?.safety === 'limited') {
    verdict = 'limited';
    lines.push(`Only in small amounts, if at all: ${record.name}.`, record.why);
    if (record.guidance) lines.push(record.guidance);
  } else if (risky.length) {
    verdict = 'caution';
    lines.push(`Caution with "${food}".`, ...risky.map(item => item.reason));
  } else if (record?.safety === 'safe') {
    // Only the preparation guidance is passed on for safe foods. The record's
    // `why` field carries benefit wording that isn't appropriate as a claim.
    verdict = 'generally_safe';
    lines.push(`${capitalize(record.name)} is generally considered dog-safe in moderation, when served plain.`);
    if (record.guidance) lines.push(record.guidance);
    lines.push('Introduce any new food slowly and stop if your dog shows stomach upset.');
  } else {
    verdict = 'unknown';
    lines.push(
      `"${food}" isn't in Cheffo Doggo's reference list, so we can't say whether it's safe. That doesn't mean it is safe. Ask your veterinarian before feeding it.`
    );
  }

  if (risky.length && verdict !== 'caution') lines.push(...risky.map(item => item.reason));
  lines.push(VET_LINE);
  return { food, verdict, text: lines.join('\n') };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface CalorieInput {
  weight: number;
  unit: 'lb' | 'kg';
  lifeStage: LifeStage;
  activityLevel?: ActivityLevel;
}

export interface CalorieResult {
  weightLbs: number;
  restingKcal: number;
  dailyKcal: number;
  text: string;
}

export function dailyCalorieEstimate(input: CalorieInput): CalorieResult {
  const weightLbs = input.unit === 'kg' ? input.weight / 0.453592 : input.weight;
  if (!Number.isFinite(weightLbs) || weightLbs < LIMITS.weightMin || weightLbs > LIMITS.weightMax) {
    throw new RangeError(`Weight must be between ${LIMITS.weightMin} and ${LIMITS.weightMax} lb.`);
  }
  const activityLevel = input.activityLevel ?? 'moderate';
  // calcDER only reads weight, ideal weight, life stage and activity level —
  // the same four inputs the public calculator page asks for.
  const dog = { weightLbs, lifeStage: input.lifeStage, activityLevel } as unknown as DogProfile;
  const restingKcal = Math.round(calcRER(weightLbs));
  const dailyKcal = Math.round(calcDER(dog));
  const kg = Math.round(lbsToKg(weightLbs) * 10) / 10;
  const lbs = Math.round(weightLbs * 10) / 10;

  const lines = [
    `Estimated daily calories: about ${dailyKcal} kcal/day for a ${lbs} lb (${kg} kg) ${input.lifeStage} dog` +
      (input.lifeStage === 'adult' ? ` with ${activityLevel.replace('_', ' ')} activity.` : '.'),
    `Resting energy (RER = 70 × kg^0.75): about ${restingKcal} kcal/day.`,
    'This is a starting estimate from a standard formula. Real needs vary with metabolism, neuter status, body condition and health, so weigh your dog regularly and adjust with your vet.',
  ];
  if (input.lifeStage === 'puppy') {
    lines.push('Puppy needs change quickly as they grow. Recheck the estimate with your veterinarian every few weeks.');
  }
  lines.push(`Build a portioned recipe for this calorie target at ${SITE_URL}.`, VET_LINE);
  return { weightLbs, restingKcal, dailyKcal, text: lines.join('\n') };
}

export interface TreatInput {
  category?: TreatCategory;
  avoid?: string[];
  pick?: number;
}

export interface TreatResult {
  templateId: string | null;
  text: string;
}

export function treatIdea(input: TreatInput): TreatResult {
  const avoid = (input.avoid ?? [])
    .slice(0, LIMITS.avoidMaxItems)
    .map(term => cleanText(term, LIMITS.avoidMaxChars).toLowerCase())
    .filter(Boolean);
  const matches = TREAT_CATALOG.filter(card =>
    (!input.category || card.category === input.category) &&
    !card.ingredients.some(name => avoid.some(term => name.toLowerCase().includes(term) || mentions(term, name)))
  );

  if (!matches.length) {
    return {
      templateId: null,
      text: [
        'No treat in Cheffo Doggo\'s catalog fits those filters.',
        `You can build a custom treat that skips those ingredients at ${SITE_URL}.`,
        VET_LINE,
      ].join('\n'),
    };
  }

  const card = matches[Math.abs(Math.trunc(input.pick ?? 0)) % matches.length];
  const template = TREAT_TEMPLATES.find(item => item.id === card.templateId);
  const lines = [
    `Treat idea: ${card.name} (${card.category}, ${card.level.toLowerCase()} to make).`,
    `Ingredients: ${card.ingredients.join(', ')}.`,
  ];
  if (template?.cookTimeMinutes) lines.push(`Time: about ${template.cookTimeMinutes} minutes.`);
  if (avoid.length) lines.push(`Skips: ${avoid.join(', ')}. Double-check every label for hidden ingredients.`);
  lines.push(
    'Treats should make up no more than 10% of your dog\'s daily calories.',
    `Get amounts portioned for your dog and step-by-step instructions at ${SITE_URL}.`,
    VET_LINE,
  );
  return { templateId: card.templateId, text: lines.join('\n') };
}
