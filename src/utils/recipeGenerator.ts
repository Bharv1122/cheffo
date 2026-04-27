// RECIPE GENERATOR — Mock implementation using templates + calculation.
// To connect a real AI API, replace the body of generateRecipe() below.
// The function signature and return type stay the same.

import type { DogProfile } from '../types/dog';
import type {
  Recipe, RecipeType, RecipeIngredient, CookingStep,
  SupplementItem, ShoppingListItem, BatchDuration,
} from '../types/recipe';
import {
  TOPPER_TEMPLATES, FULL_MEAL_TEMPLATES, BATCH_TEMPLATES,
  TREAT_TEMPLATES, type RecipeTemplate,
} from '../data/recipeTemplates';
import { getIngredientById } from '../data/ingredients';
import { getAllSupplements } from '../data/supplements';
import {
  calcServing,
  calcBatch,
  splitIngredients,
  calcDER,
  gramsToOz,
  gramsToCups,
  groceryLabel,
  cupsToMl,
  formatMetricIngredient,
  formatVolumeIngredient,
} from './calculator';
import { validateIngredients, GENERAL_VET_DISCLAIMER, SUPPLEMENT_SAFETY_NOTE } from './safetyValidator';
import { generateId } from './storage';
import { generateRecipeImage } from './recipeImageGenerator';

export interface GeneratorInput {
  dog: DogProfile;
  recipeType: RecipeType;
  batchDuration?: BatchDuration;
  preferredProteinIds?: string[];
  budgetMode?: boolean;
  pantryIngredientIds?: string[];
  forceTemplateId?: string;
}

interface RestrictionMatch {
  restrictedTerm: string;
  ingredientName: string;
}

function normalizeFoodTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDogAvoidFoods(dog: DogProfile): string[] {
  const dogWithAliases = dog as DogProfile & { foodsToAvoid?: string[] };
  return [...(dog.avoidFoods ?? []), ...(dogWithAliases.foodsToAvoid ?? [])];
}

function getDogRestrictedTerms(dog: DogProfile): string[] {
  const normalized = [...(dog.allergies ?? []), ...getDogAvoidFoods(dog)]
    .map(normalizeFoodTerm)
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function findRestrictionMatchesForIngredient(
  ingredientName: string,
  ingredientAliases: string[],
  restrictedTerms: string[]
): RestrictionMatch[] {
  if (!restrictedTerms.length) return [];

  const searchableValues = [ingredientName, ...ingredientAliases]
    .map(normalizeFoodTerm)
    .filter(Boolean);

  const matches = new Map<string, RestrictionMatch>();

  for (const restrictedTerm of restrictedTerms) {
    const found = searchableValues.some(value => value.includes(restrictedTerm));
    if (found) {
      matches.set(`${restrictedTerm}::${ingredientName}`, {
        restrictedTerm,
        ingredientName,
      });
    }
  }

  return Array.from(matches.values());
}

function findTemplateRestrictionMatches(template: RecipeTemplate, restrictedTerms: string[]): RestrictionMatch[] {
  if (!restrictedTerms.length) return [];

  const ingredientIds = [
    ...template.proteinIds,
    ...template.carbIds,
    ...template.vegetableIds,
    ...template.fatIds,
    ...template.supplementIds,
  ];

  const matches: RestrictionMatch[] = [];

  for (const ingredientId of ingredientIds) {
    const ingredient = getIngredientById(ingredientId);
    if (!ingredient) continue;

    matches.push(
      ...findRestrictionMatchesForIngredient(
        ingredient.name,
        ingredient.aliases ?? [],
        restrictedTerms
      )
    );
  }

  return matches;
}

function buildRestrictionSummary(matches: RestrictionMatch[]): string {
  return matches
    .map(match => `"${match.ingredientName}" matched "${match.restrictedTerm}"`)
    .join(', ');
}

function validateRecipeAgainstDogRestrictions(
  ingredients: RecipeIngredient[],
  dog: DogProfile
): { isSafe: boolean; matches: RestrictionMatch[] } {
  const restrictedTerms = getDogRestrictedTerms(dog);
  const matches = ingredients.flatMap(ingredient => {
    const source = getIngredientById(ingredient.ingredientId);
    return findRestrictionMatchesForIngredient(
      ingredient.name,
      source?.aliases ?? [],
      restrictedTerms
    );
  });

  return {
    isSafe: matches.length === 0,
    matches,
  };
}

// REPLACE THIS FUNCTION BODY with a real API call when ready.
export async function generateRecipe(input: GeneratorInput): Promise<Recipe> {
  const { dog, recipeType, batchDuration = '7day' } = input;

  const restrictedTerms = getDogRestrictedTerms(dog);
  console.info('[RecipeSafety] Generating recipe with restrictions:', {
    dogId: dog.id,
    dogName: dog.name,
    recipeType,
    restrictedTerms,
    allergies: dog.allergies,
    avoidFoods: getDogAvoidFoods(dog),
  });

  // 1. Pick template
  const template = pickTemplate(input);

  // 2. Safety check on all template ingredient names
  const ingredientNames = [
    ...template.proteinIds,
    ...template.carbIds,
    ...template.vegetableIds,
    ...template.fatIds,
    ...template.supplementIds,
  ]
    .map(id => getIngredientById(id)?.name ?? id)
    .filter(Boolean);

  const safety = validateIngredients(ingredientNames, dog);
  if (!safety.safe) {
    console.error('[RecipeSafety] Template-level safety validation failed', {
      templateId: template.id,
      templateName: template.name,
      errors: safety.errors,
    });
    throw new Error(`Safety check failed: ${safety.errors.join('; ')}`);
  }

  // 3. Calculate portions
  const baseServing = calcServing(dog);
  const effectiveDuration: BatchDuration =
    recipeType === 'full_meal' || recipeType === 'batch_week' ? batchDuration : '1day';
  const batch = calcBatch(baseServing, effectiveDuration);

  const treatDailyCalorieCap = Math.max(1, Math.round(calcDER(dog) * 0.1));
  const treatDailyGramsCap = Math.max(10, Math.round(treatDailyCalorieCap / 3)); // ~3 kcal/g treat estimate

  const serving = recipeType === 'treat'
    ? {
        gramsPerMeal: Math.max(5, Math.round(treatDailyGramsCap / 2)),
        cupsPerMeal: Math.round((Math.max(5, Math.round(treatDailyGramsCap / 2)) / 240) * 10) / 10,
        mealsPerDay: 2,
        totalDailyGrams: treatDailyGramsCap,
      }
    : baseServing;

  const totalGrams = recipeType === 'topper'
    ? Math.round(baseServing.totalDailyGrams * 0.15) // toppers are ~15% of daily food
    : recipeType === 'treat'
    ? treatDailyGramsCap
    : batch.totalYieldGrams;

  const split = splitIngredients(totalGrams);

  // 4. Build ingredient list
  const ingredients = buildIngredients(template, split, recipeType, dog);

  // 4b. Final strict validation before recipe can be shown/saved
  const strictAllergenValidation = validateRecipeAgainstDogRestrictions(ingredients, dog);
  if (!strictAllergenValidation.isSafe) {
    const summary = buildRestrictionSummary(strictAllergenValidation.matches);
    console.error('[RecipeSafety] Final recipe validation failed', {
      templateId: template.id,
      templateName: template.name,
      matches: strictAllergenValidation.matches,
    });
    throw new Error(`Safety check failed: restricted ingredients detected in generated recipe (${summary}).`);
  }

  console.info('[RecipeSafety] Final recipe passed strict allergen validation', {
    templateId: template.id,
    templateName: template.name,
    restrictedTerms,
  });

  // 5. Build cooking steps
  const instructions = buildInstructions(template, recipeType);

  // 5b. Estimate nutrition from actual ingredient composition
  const estimatedNutrition = estimateNutrition(ingredients, recipeType, serving, batch, treatDailyCalorieCap);

  // 6. Build supplement list (full meals only)
  const supplements: SupplementItem[] = recipeType === 'full_meal' || recipeType === 'batch_week'
    ? buildSupplements(dog)
    : [];

  // 7. Build shopping list
  const shoppingList = buildShoppingList(ingredients, supplements, recipeType, batch);

  // 8. Build storage info
  const storage = buildStorage(recipeType);

  // 9. Safety notes
  const safetyNotes = buildSafetyNotes(recipeType, template, dog, safety.warnings);

  // 10. Transition guide (full meals only)
  const transitionGuide = recipeType === 'full_meal' ? TRANSITION_GUIDE : undefined;

  const now = new Date().toISOString();

  const baseRecipe: Recipe = {
    id: generateId(),
    dogProfileId: dog.id,
    name: template.name,
    description: template.description,
    type: recipeType,
    ingredients,
    instructions,
    nutrition: estimatedNutrition,
    serving,
    batch,
    supplements,
    storage,
    shoppingList,
    safetyNotes,
    allergenSafety: {
      checkedTerms: restrictedTerms,
      allergenFree: true,
      warning: undefined,
      matchedIngredients: [],
    },
    vetDisclaimer: GENERAL_VET_DISCLAIMER,
    isFavorite: false,
    scaleFactor: 1,
    transitionGuide,
    createdAt: now,
    updatedAt: now,
  };

  const imageUrl = await generateRecipeImage(baseRecipe);
  return {
    ...baseRecipe,
    imageUrl,
  };
}

function estimateNutrition(
  ingredients: RecipeIngredient[],
  recipeType: RecipeType,
  serving: { mealsPerDay: number },
  batch: { numberOfMeals: number },
  treatDailyCalorieCap: number
) {
  const totalCalories = ingredients.reduce((sum, ingredient) => {
    const source = getIngredientById(ingredient.ingredientId);
    if (!source) return sum;
    return sum + source.caloriesPerGram * ingredient.amountGrams;
  }, 0);

  if (recipeType === 'treat') {
    return {
      caloriesPerServing: Math.max(1, Math.round(treatDailyCalorieCap / serving.mealsPerDay)),
      caloriesPerDay: treatDailyCalorieCap,
      isEstimate: true as const,
    };
  }

  const servings = recipeType === 'full_meal' || recipeType === 'batch_week'
    ? Math.max(1, batch.numberOfMeals)
    : Math.max(1, serving.mealsPerDay);

  const caloriesPerServing = Math.max(1, Math.round(totalCalories / servings));

  return {
    caloriesPerServing,
    caloriesPerDay: Math.max(1, Math.round(caloriesPerServing * serving.mealsPerDay)),
    isEstimate: true as const,
  };
}

interface CandidateTemplateScore {
  template: RecipeTemplate;
  score: number;
  pantryOverlapCount: number;
}

const TEMPLATE_HISTORY_MAX = 12;
const RECENT_TEMPLATE_PENALTY = 2.5;

function getTemplateHistoryKey(dogId: string, recipeType: RecipeType): string {
  return `chef-doggo:template-history:${dogId}:${recipeType}`;
}

function getRecentTemplateHistory(dogId: string, recipeType: RecipeType): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getTemplateHistoryKey(dogId, recipeType));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function rememberTemplateChoice(dogId: string, recipeType: RecipeType, templateId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const existing = getRecentTemplateHistory(dogId, recipeType);
  const next = [templateId, ...existing.filter(id => id !== templateId)].slice(0, TEMPLATE_HISTORY_MAX);

  try {
    window.localStorage.setItem(getTemplateHistoryKey(dogId, recipeType), JSON.stringify(next));
  } catch {
    // Ignore storage write failures (private mode, quota, etc.)
  }
}

function countTemplatePantryMatches(template: RecipeTemplate, pantryIngredientIds: string[]): number {
  if (!pantryIngredientIds.length) return 0;

  const pantrySet = new Set(pantryIngredientIds);
  const templateIngredients = [
    ...template.proteinIds,
    ...template.carbIds,
    ...template.vegetableIds,
    ...template.fatIds,
    ...template.supplementIds,
  ];

  return templateIngredients.reduce((count, ingredientId) => {
    return count + (pantrySet.has(ingredientId) ? 1 : 0);
  }, 0);
}

function scoreTemplateForDog(
  template: RecipeTemplate,
  dog: DogProfile,
  preferredProteinIds: string[],
  pantryIngredientIds: string[],
  recentTemplateIds: string[]
): CandidateTemplateScore {
  let score = 1;
  const templateTags = template.tags.map(tag => normalizeFoodTerm(tag));

  const favoriteProteinSet = new Set(dog.favoriteProteins ?? []);
  const preferredProteinSet = new Set(preferredProteinIds ?? []);

  const favoriteProteinMatches = template.proteinIds.filter(id => favoriteProteinSet.has(id)).length;
  if (favoriteProteinMatches > 0) {
    score += favoriteProteinMatches * 3;
  }

  const explicitProteinMatches = template.proteinIds.filter(id => preferredProteinSet.has(id)).length;
  if (explicitProteinMatches > 0) {
    score += explicitProteinMatches * 4;
  }

  if (template.textureProfile === dog.texturePreference) {
    score += 2.5;
  }

  if (template.skillLevel === 'any' || template.skillLevel === dog.parentSkillLevel) {
    score += 1.5;
  }

  if (dog.pickyEater) {
    if (template.textureProfile === 'soft' || template.textureProfile === 'brothy') {
      score += 2;
    }
    if (templateTags.some(tag => tag.includes('picky'))) {
      score += 2;
    }
  }

  if (dog.lifeStage === 'senior') {
    if (template.textureProfile === 'soft' || template.textureProfile === 'brothy') {
      score += 1.5;
    }
    if (templateTags.some(tag => tag.includes('gentle') || tag.includes('joint') || tag.includes('omega'))) {
      score += 1;
    }
  }

  if (dog.lifeStage === 'puppy') {
    if (templateTags.some(tag => tag.includes('gentle') || tag.includes('beginner') || tag.includes('classic'))) {
      score += 1;
    }
  }

  if (dog.activityLevel === 'active' || dog.activityLevel === 'very_active') {
    if (templateTags.some(tag => tag.includes('active') || tag.includes('beef') || tag.includes('salmon'))) {
      score += 1.5;
    }
  }

  if (dog.activityLevel === 'low') {
    if (templateTags.some(tag => tag.includes('gentle') || tag.includes('digest'))) {
      score += 1;
    }
  }

  const pantryOverlapCount = countTemplatePantryMatches(template, pantryIngredientIds);
  if (pantryOverlapCount > 0) {
    score += pantryOverlapCount * 2;
  }

  const recentIndex = recentTemplateIds.findIndex(templateId => templateId === template.id);
  if (recentIndex >= 0) {
    // stronger penalty for most recent recipes to keep variety
    score -= (TEMPLATE_HISTORY_MAX - recentIndex) * RECENT_TEMPLATE_PENALTY;
  }

  return {
    template,
    score,
    pantryOverlapCount,
  };
}

function chooseTemplateByScore(scoredTemplates: CandidateTemplateScore[]): RecipeTemplate {
  const sorted = [...scoredTemplates].sort((a, b) => b.score - a.score);
  const topSlice = sorted.slice(0, Math.min(3, sorted.length));

  const positiveWeights = topSlice.map(item => Math.max(1, Math.round((item.score + 10) * 10)));
  const weightTotal = positiveWeights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * weightTotal;

  for (let idx = 0; idx < topSlice.length; idx++) {
    roll -= positiveWeights[idx];
    if (roll <= 0) {
      return topSlice[idx].template;
    }
  }

  return topSlice[0].template;
}

// ── Template selection ─────────────────────────────────────────────────────────
function pickTemplate(input: GeneratorInput): RecipeTemplate {
  const {
    recipeType,
    forceTemplateId,
    preferredProteinIds = [],
    budgetMode,
    dog,
    pantryIngredientIds = [],
  } = input;

  const pool: RecipeTemplate[] =
    recipeType === 'topper' ? TOPPER_TEMPLATES :
    recipeType === 'full_meal' ? FULL_MEAL_TEMPLATES :
    recipeType === 'batch_week' ? BATCH_TEMPLATES :
    recipeType === 'treat' ? TREAT_TEMPLATES :
    [...TOPPER_TEMPLATES, ...FULL_MEAL_TEMPLATES];

  const restrictedTerms = getDogRestrictedTerms(dog);

  if (forceTemplateId) {
    const found = pool.find(t => t.id === forceTemplateId);
    if (found) {
      const forcedMatches = findTemplateRestrictionMatches(found, restrictedTerms);
      if (forcedMatches.length) {
        const summary = buildRestrictionSummary(forcedMatches);
        console.error('[RecipeSafety] Forced template blocked by restrictions', {
          templateId: found.id,
          templateName: found.name,
          restrictedTerms,
          matches: forcedMatches,
        });
        throw new Error(`Selected recipe conflicts with your dog's restricted foods: ${summary}.`);
      }
      console.info('[RecipeSafety] Using explicitly requested safe template', {
        templateId: found.id,
        templateName: found.name,
      });
      rememberTemplateChoice(dog.id, recipeType, found.id);
      return found;
    }
  }

  // Filter by budget
  let candidates = budgetMode ? pool.filter(t => t.budgetFriendly) : [...pool];
  if (!candidates.length) candidates = [...pool];

  // Filter by preferred proteins
  if (preferredProteinIds.length) {
    const proteinMatch = candidates.filter(t =>
      t.proteinIds.some(p => preferredProteinIds.includes(p))
    );
    if (proteinMatch.length) candidates = proteinMatch;
  }

  // Pantry mode should prioritize what the user actually has on hand.
  if (pantryIngredientIds.length) {
    const pantryMatches = candidates.filter(template => countTemplatePantryMatches(template, pantryIngredientIds) > 0);
    if (pantryMatches.length) {
      candidates = pantryMatches;
    }
  }

  const excludedReasons = new Map<string, RestrictionMatch[]>();
  const safeCandidates = candidates.filter(template => {
    const matches = findTemplateRestrictionMatches(template, restrictedTerms);
    if (matches.length) {
      excludedReasons.set(template.id, matches);
      return false;
    }
    return true;
  });

  if (excludedReasons.size > 0) {
    console.info(
      '[RecipeSafety] Filtered templates due to dog allergies/avoid foods:',
      Array.from(excludedReasons.entries()).map(([templateId, matches]) => ({
        templateId,
        reason: buildRestrictionSummary(matches),
      }))
    );
  }

  if (!safeCandidates.length) {
    throw new Error(
      `No safe ${recipeType.replace('_', ' ')} recipe templates available for ${dog.name}'s restrictions: ${restrictedTerms.join(', ') || 'none provided'}.`
    );
  }

  const recentTemplateIds = getRecentTemplateHistory(dog.id, recipeType);
  const scoredCandidates = safeCandidates.map(template =>
    scoreTemplateForDog(template, dog, preferredProteinIds, pantryIngredientIds, recentTemplateIds)
  );

  const selectedTemplate = chooseTemplateByScore(scoredCandidates);
  rememberTemplateChoice(dog.id, recipeType, selectedTemplate.id);

  console.info('[RecipeGenerator] Selected template', {
    recipeType,
    dogId: dog.id,
    selectedTemplateId: selectedTemplate.id,
    candidateScores: scoredCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => ({
        templateId: item.template.id,
        score: Number(item.score.toFixed(2)),
        pantryOverlapCount: item.pantryOverlapCount,
      })),
    recentTemplateIds,
  });

  return selectedTemplate;
}

// ── Ingredient builder ────────────────────────────────────────────────────────
function baseFishOilDailyGrams(weightLbs: number): number {
  const estimate = weightLbs * 0.05; // ~1g fish oil per 20 lbs body weight
  return Math.round(Math.min(3, Math.max(0.5, estimate)) * 10) / 10;
}

function scaledFishOilGrams(weightLbs: number, totalGrams: number): number {
  const dailyAmount = baseFishOilDailyGrams(weightLbs);
  const ingredientScaledAmount = Math.max(dailyAmount, totalGrams * 0.005);
  return Math.round(ingredientScaledAmount * 10) / 10;
}

function buildIngredients(
  template: RecipeTemplate,
  split: { proteinGrams: number; carbGrams: number; vegGrams: number; fatGrams: number },
  recipeType: RecipeType,
  dog: DogProfile
): RecipeIngredient[] {
  const items: RecipeIngredient[] = [];

  const addIngredients = (
    ids: string[],
    totalGrams: number,
    category: RecipeIngredient['category']
  ) => {
    if (!ids.length) return;
    const gramsEach = Math.round(totalGrams / ids.length);
    for (const id of ids) {
      const ing = getIngredientById(id);
      if (!ing) continue;

      const isFishOilSupplement = id === 'fish_oil';
      const amountGrams = isFishOilSupplement ? scaledFishOilGrams(dog.weightLbs, totalGrams) : gramsEach;
      const amountCups = isFishOilSupplement ? undefined : gramsToCups(amountGrams);
      const amountOz = gramsToOz(amountGrams);
      const amountMl = amountCups ? cupsToMl(amountCups) : Math.max(1, Math.round(amountGrams));
      const ingredientBase = {
        name: ing.name,
        amountGrams,
        amountCups,
        amountMl,
        category: isFishOilSupplement ? 'supplement' as const : category,
      };

      items.push({
        ingredientId: id,
        ...ingredientBase,
        amountOz,
        groceryFriendlyAmount: isFishOilSupplement
          ? `about ${amountGrams}g (${amountOz} oz) ${ing.name} total`
          : groceryLabel(amountGrams, ing.name),
        displayMetric: formatMetricIngredient(ingredientBase),
        displayVolume: formatVolumeIngredient(ingredientBase),
        prepNote: ing.prepNotes,
      });
    }
  };

  if (recipeType === 'treat') {
    // treats use small fixed amounts
    const allIds = [
      ...template.proteinIds, ...template.carbIds,
      ...template.vegetableIds, ...template.supplementIds,
    ];
    allIds.forEach(id => {
      const ing = getIngredientById(id);
      if (!ing) return;
      const g = 50;
      const cat: RecipeIngredient['category'] =
        ing.category === 'treat' ? 'treat' : ing.category;
      const amountCups = gramsToCups(g);
      const ingredientBase = {
        name: ing.name,
        category: cat,
        amountGrams: g,
        amountCups,
        amountMl: cupsToMl(amountCups),
      };

      items.push({
        ingredientId: id,
        ...ingredientBase,
        amountOz: gramsToOz(g),
        groceryFriendlyAmount: groceryLabel(g, ing.name),
        displayMetric: formatMetricIngredient(ingredientBase),
        displayVolume: formatVolumeIngredient(ingredientBase),
        prepNote: ing.prepNotes,
      });
    });
    return items;
  }

  addIngredients(template.proteinIds, split.proteinGrams, 'protein');
  addIngredients(template.carbIds, split.carbGrams, 'carb');
  addIngredients(template.vegetableIds, split.vegGrams, 'vegetable');
  addIngredients(template.fatIds, split.fatGrams, 'fat');

  return items;
}

// ── Instructions builder ──────────────────────────────────────────────────────
function buildInstructions(template: RecipeTemplate, recipeType: RecipeType): CookingStep[] {
  const isTopper = recipeType === 'topper';
  const isTreat = recipeType === 'treat';
  const isBatch = recipeType === 'batch_week';

  const proteins = template.proteinIds.map(id => getIngredientById(id)?.name ?? id).join(' and ');
  const carbs = template.carbIds.map(id => getIngredientById(id)?.name ?? id).join(' and ');
  const vegs = template.vegetableIds.map(id => getIngredientById(id)?.name ?? id).join(' and ');

  if (isTreat) {
    return TREAT_INSTRUCTIONS[template.id] ?? DEFAULT_TREAT_INSTRUCTIONS;
  }

  const steps: CookingStep[] = [
    {
      stepNumber: 1,
      instruction: `Gather all ingredients: ${[proteins, carbs, vegs].filter(Boolean).join(', ')}. Weigh or measure according to your dog's portion size.`,
      tip: 'Prep everything before you start cooking — it makes the process much smoother.',
    },
  ];

  let step = 2;

  if (template.proteinIds.length) {
    steps.push({
      stepNumber: step++,
      instruction: `Cook ${proteins}: ${getIngredientById(template.proteinIds[0])?.prepNotes ?? 'Cook thoroughly with no seasoning until cooked through. No salt, oil, or spices.'}`,
      durationMinutes: template.type === 'batch_week' ? 30 : 20,
      tip: 'Internal temperature for poultry should reach 165°F. For ground meats, 160°F.',
    });
  }

  if (template.carbIds.length) {
    steps.push({
      stepNumber: step++,
      instruction: `Cook ${carbs}: ${getIngredientById(template.carbIds[0])?.prepNotes ?? 'Cook plain in water with no salt or seasoning.'}`,
      durationMinutes: 20,
      tip: 'Cook the carbs at the same time as the protein to save time.',
    });
  }

  if (template.vegetableIds.length) {
    steps.push({
      stepNumber: step++,
      instruction: `Prepare vegetables: Steam or lightly boil ${vegs} until just soft. Do not overcook — you want them soft enough for your dog to chew easily.`,
      durationMinutes: 10,
      tip: 'Steaming preserves more nutrients than boiling.',
    });
  }

  steps.push({
    stepNumber: step++,
    instruction: 'Let everything cool completely to room temperature before combining. Never add supplements or fish oil to hot food.',
    tip: 'Hot food can destroy the omega-3s in fish oil and some vitamins. Always cool first.',
  });

  steps.push({
    stepNumber: step++,
    instruction: 'Combine protein, carbs, and vegetables in a large bowl. Mix gently. Add fish oil and any supplements now.',
    tip: 'For batch cooking, use a large pot or mixing bowl. Mix thoroughly so supplements are evenly distributed.',
  });

  if (isBatch) {
    steps.push({
      stepNumber: step++,
      instruction: 'Divide the batch into individual meal-sized portions. Use airtight containers. Label each container with the date.',
      tip: 'Silicone muffin trays work great for freezing individual portions.',
    });
    steps.push({
      stepNumber: step++,
      instruction: 'Refrigerate 3–4 days\' worth of portions. Freeze the remaining portions. Thaw in the refrigerator overnight before serving.',
      durationMinutes: 5,
      tip: 'Never thaw in the microwave — it creates uneven hot spots and can degrade nutrients.',
    });
  } else if (!isTopper) {
    steps.push({
      stepNumber: step++,
      instruction: 'Portion into meal-sized servings. Store in airtight containers in the refrigerator for up to 3–4 days, or freeze for up to 3 months.',
    });
  }

  steps.push({
    stepNumber: step++,
    instruction: 'Serve at room temperature or slightly warm. Start with small amounts if transitioning from commercial food, and increase gradually over 7–10 days.',
    tip: isTopper
      ? 'Add the topper on top of your dog\'s regular food. Start with a tablespoon and adjust to the recommended serving amount.'
      : 'Sudden diet changes can cause digestive upset. Introduce homemade food gradually.',
  });

  return steps;
}

// ── Supplement builder ────────────────────────────────────────────────────────
function buildSupplements(dog: DogProfile): SupplementItem[] {
  return getAllSupplements().map(s => ({
    name: s.name,
    category: s.category,
    isRequired: s.isRequired,
    estimatedAmount: s.estimatedRangeNote,
    vetReviewNote: SUPPLEMENT_SAFETY_NOTE,
    exampleProducts: s.exampleProducts,
  }));
}

// ── Shopping list builder ─────────────────────────────────────────────────────
function buildShoppingList(
  ingredients: RecipeIngredient[],
  supplements: SupplementItem[],
  recipeType: RecipeType,
  batch: { numberOfContainers: number }
): ShoppingListItem[] {
  const items: ShoppingListItem[] = ingredients.map(ing => ({
    name: ing.name,
    displayAmount: ing.displayVolume ?? ing.groceryFriendlyAmount,
    displayAmountMetric: ing.displayMetric,
    displayAmountVolume: ing.displayVolume,
    category: ingCategoryToShopping(ing.category),
    note: ing.prepNote,
  }));

  if (recipeType === 'full_meal' || recipeType === 'batch_week') {
    const hasFishOilInIngredients = ingredients.some(ing => ing.ingredientId === 'fish_oil');

    for (const s of supplements) {
      const isOmega3 = s.name.toLowerCase().includes('omega-3');
      if (!s.isRequired || (isOmega3 && hasFishOilInIngredients)) {
        continue;
      }

      items.push({
        name: s.name,
        displayAmount: '(ask your vet for dosing)',
        displayAmountMetric: '(ask your vet for dosing)',
        displayAmountVolume: '(ask your vet for dosing)',
        category: 'supplement',
        note: s.vetReviewNote,
      });
    }

    if (recipeType === 'batch_week') {
      items.push({
        name: 'Airtight storage containers',
        displayAmount: `${batch.numberOfContainers}+ meal-sized containers`,
        displayAmountMetric: `${batch.numberOfContainers}+ meal-sized containers`,
        displayAmountVolume: `${batch.numberOfContainers}+ meal-sized containers`,
        category: 'equipment',
        note: 'Glass or BPA-free plastic. Label each with date.',
      });
    }
  }

  const deduped = new Map<string, ShoppingListItem>();
  for (const item of items) {
    const key = `${item.category}::${item.name.trim().toLowerCase()}::${item.displayAmount.trim().toLowerCase()}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, item);
      continue;
    }

    if (!existing.note && item.note) {
      deduped.set(key, { ...existing, note: item.note });
    }
  }

  return Array.from(deduped.values());
}

function ingCategoryToShopping(cat: RecipeIngredient['category']): ShoppingListItem['category'] {
  if (cat === 'protein') return 'protein';
  if (cat === 'supplement') return 'supplement';
  if (cat === 'carb') return 'pantry';
  return 'produce';
}

// ── Storage info ──────────────────────────────────────────────────────────────
function buildStorage(recipeType: RecipeType) {
  if (recipeType === 'topper') {
    return {
      fridgeDays: 3,
      freezerMonths: 1,
      thawInstructions: 'Thaw overnight in the refrigerator. Do not thaw at room temperature.',
      servingTemperature: 'Room temperature or slightly warm.',
      portioningNotes: 'Store in a small airtight container. Make small batches — toppers are occasional additions.',
    };
  }
  if (recipeType === 'treat') {
    return {
      fridgeDays: 5,
      freezerMonths: 2,
      thawInstructions: 'Frozen treats can be served directly from the freezer.',
      servingTemperature: 'Room temperature for baked treats. Frozen for frozen treats.',
      portioningNotes: 'Store baked treats in an airtight container at room temperature for up to 5 days, or freeze for longer shelf life.',
    };
  }
  return {
    fridgeDays: 4,
    freezerMonths: 3,
    thawInstructions: 'Thaw frozen portions in the refrigerator overnight. Never microwave — it creates hot spots and can degrade nutrients.',
    servingTemperature: 'Room temperature or slightly warm. Never serve cold from the fridge — let it sit out for 10–15 minutes.',
    portioningNotes: 'Portion into individual meal-sized containers. Label each with the date. Keep the next 3–4 days in the fridge; freeze the rest immediately.',
  };
}

// ── Safety notes builder ───────────────────────────────────────────────────────
function buildSafetyNotes(
  recipeType: RecipeType,
  template: RecipeTemplate,
  dog: DogProfile,
  existingWarnings: string[]
): string[] {
  const notes = [...existingWarnings];
  const restrictedTerms = getDogRestrictedTerms(dog);

  notes.push('All ingredients have been checked against the common toxic foods list for dogs.');
  if (restrictedTerms.length) {
    notes.push(`Allergen profile check passed for: ${restrictedTerms.join(', ')}.`);
  }

  if (recipeType === 'full_meal' || recipeType === 'batch_week') {
    notes.push('Homemade dog food usually needs supplementation to be nutritionally complete. See the supplement checklist below.');
    notes.push('Introduce this food gradually over 7–10 days, mixing it with your dog\'s current food and increasing the new food each day.');
  }

  if (recipeType === 'topper') {
    notes.push('This topper is designed to complement your dog\'s regular complete food, not replace it. Serve as an occasional addition.');
    notes.push('The suggested serving amount is approximately 10–15% of your dog\'s daily food intake.');
  }

  if (recipeType === 'treat') {
    notes.push('Treats should make up no more than 10% of your dog\'s daily caloric intake.');
    notes.push('This recipe contains no chocolate, xylitol, grapes, raisins, onion, or garlic.');
  }

  if (dog.lifeStage === 'puppy') {
    notes.push('Puppies have unique nutritional needs. Please consult a veterinarian or veterinary nutritionist before feeding homemade food to your puppy.');
  }

  if (dog.lifeStage === 'senior') {
    notes.push('Senior dogs may have different caloric and nutrient needs. Consider consulting your veterinarian about this recipe.');
  }

  return notes;
}

// ── Transition guide ───────────────────────────────────────────────────────────
const TRANSITION_GUIDE = [
  'Days 1–2: Feed 75% current food + 25% homemade food.',
  'Days 3–4: Feed 50% current food + 50% homemade food.',
  'Days 5–6: Feed 25% current food + 75% homemade food.',
  'Day 7+: Feed 100% homemade food (if no digestive issues).',
  'If your dog shows signs of digestive upset (loose stools, vomiting, excessive gas) at any stage, slow down the transition.',
  'Always consult your veterinarian before starting a homemade diet, especially for puppies, seniors, or dogs with health conditions.',
];

// ── Treat-specific instructions ───────────────────────────────────────────────
const DEFAULT_TREAT_INSTRUCTIONS: CookingStep[] = [
  { stepNumber: 1, instruction: 'Preheat oven to 350°F (175°C) if baking. Line a baking sheet with parchment paper.' },
  { stepNumber: 2, instruction: 'Combine all ingredients in a mixing bowl. Mix until well combined.' },
  { stepNumber: 3, instruction: 'Roll out or drop spoonfuls onto the prepared baking sheet.', tip: 'Smaller treats are better for training — aim for pea-sized pieces.' },
  { stepNumber: 4, instruction: 'Bake for 20–25 minutes until firm and lightly golden. Let cool completely before serving.', durationMinutes: 25 },
  { stepNumber: 5, instruction: 'Store in an airtight container at room temperature for up to 5 days, or freeze for up to 2 months.' },
];

const TREAT_INSTRUCTIONS: Record<string, CookingStep[]> = {
  treat_pb_banana_bites: [
    { stepNumber: 1, instruction: 'Mash one ripe banana in a bowl until smooth.' },
    { stepNumber: 2, instruction: 'Add xylitol-free peanut butter (verify the label!) and mix well.' },
    { stepNumber: 3, instruction: 'Spoon mixture into silicone molds or onto a parchment-lined tray.', tip: 'Ice cube trays work perfectly for portion-sized frozen treats.' },
    { stepNumber: 4, instruction: 'Freeze for at least 2 hours until solid.', durationMinutes: 120 },
    { stepNumber: 5, instruction: 'Store in the freezer in a zip-lock bag. Serve directly from the freezer.' },
  ],
  treat_yogurt_berry_lickmat: [
    { stepNumber: 1, instruction: 'Mix plain Greek yogurt and fresh or thawed blueberries in a bowl. Mash the blueberries slightly.' },
    { stepNumber: 2, instruction: 'Spread the mixture onto your lick mat, or spoon into silicone molds.', tip: 'You can also pipe it into a Kong toy and freeze.' },
    { stepNumber: 3, instruction: 'Freeze for 1–2 hours for a frozen treat, or serve fresh on the lick mat.', durationMinutes: 60 },
    { stepNumber: 4, instruction: 'Store extras in the freezer for up to 2 months.' },
  ],
  treat_sweet_potato_chews: [
    { stepNumber: 1, instruction: 'Wash sweet potatoes thoroughly. Peel if preferred.' },
    { stepNumber: 2, instruction: 'Slice into ¼-inch strips or rounds.' },
    { stepNumber: 3, instruction: 'Option A — Oven: Bake at 250°F (120°C) for 2.5–3 hours, flipping halfway, until chewy.', durationMinutes: 180, tip: 'Lower temperature = chewier result. Higher = crunchier.' },
    { stepNumber: 4, instruction: 'Option B — Dehydrator: Dehydrate at 145°F for 6–8 hours.' },
    { stepNumber: 5, instruction: 'Cool completely. Store in an airtight container in the fridge for up to 2 weeks.' },
  ],
  treat_frozen_kong: [
    { stepNumber: 1, instruction: 'Mash banana and pumpkin together in a bowl until smooth.' },
    { stepNumber: 2, instruction: 'Stir in xylitol-free peanut butter.' },
    { stepNumber: 3, instruction: 'Plug the small hole of the Kong with peanut butter, then stuff the mixture inside.' },
    { stepNumber: 4, instruction: 'Freeze for at least 4 hours or overnight.', durationMinutes: 240 },
    { stepNumber: 5, instruction: 'Serve frozen for a longer-lasting enrichment activity. Store extra filling in the freezer for up to 2 months.' },
  ],
};
