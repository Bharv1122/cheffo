// Convert a `ParsedChatRecipe` (extracted from a Cheffo Doggo chat response) into
// a full `Recipe` shaped object that fits cleanly into the user's saved recipe
// list and works with the existing batch-toggle / detail page rendering.

import type { ParsedChatRecipe } from '../types/assistant';
import type { DogProfile } from '../types/dog';
import type {
  CookingStep,
  IngredientCategory,
  Recipe,
  RecipeIngredient,
  RecipeType,
  ShoppingListItem,
} from '../types/recipe';
import { calcBatch, calcServing, gramsToCups, groceryLabel } from './calculator';
import { buildSafetyNotes } from './recipeGenerator';
import { GENERAL_VET_DISCLAIMER, validateIngredients } from './safetyValidator';
import { generateId } from './storage';

// Order matters: guessCategory returns the first category whose keyword
// substring-matches, so the specific categories must precede `protein`.
// Otherwise the broad protein keywords "egg" and "fish" swallow "eggshell
// powder" (a supplement) and "fish oil" (a fat/supplement).
const CATEGORY_KEYWORDS: Array<{ category: IngredientCategory; words: string[] }> = [
  { category: 'supplement', words: ['eggshell', 'calcium', 'vitamin', 'omega', 'glucosamine', 'chondroitin', 'probiotic', 'multivitamin'] },
  { category: 'fat', words: ['oil', 'butter', 'fat', 'tallow', 'coconut oil', 'olive oil', 'fish oil'] },
  { category: 'vegetable', words: ['carrot', 'broccoli', 'spinach', 'kale', 'pea', 'green bean', 'zucchini', 'cucumber', 'celery', 'lettuce', 'cabbage', 'blueberry', 'apple', 'banana'] },
  { category: 'carb', words: ['rice', 'oat', 'quinoa', 'barley', 'potato', 'sweet potato', 'pumpkin', 'pasta', 'noodle'] },
  { category: 'protein', words: ['chicken', 'turkey', 'beef', 'lamb', 'pork', 'fish', 'salmon', 'tuna', 'sardine', 'whitefish', 'venison', 'egg', 'liver', 'heart'] },
];

function guessCategory(name: string): IngredientCategory {
  const lower = name.toLowerCase();
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some(word => lower.includes(word))) return category;
  }
  return 'protein';
}

function ingredientCategoryToShoppingCategory(category: IngredientCategory): ShoppingListItem['category'] {
  if (category === 'protein') return 'protein';
  if (category === 'supplement') return 'supplement';
  if (category === 'carb') return 'pantry';
  if (category === 'fat') return 'pantry';
  return 'produce';
}

// "Chicken Breast" -> "chat:chicken-breast" — keeps it obvious this id didn't
// come from the canonical ingredients catalog so substitution lookups fail
// gracefully rather than mis-matching.
function slugifyName(name: string): string {
  return `chat:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

const REFERENCE_DAILY_GRAMS = 350; // rough ballpark for a 30-lb adult dog at moderate activity

// Safety gate for chat-extracted recipes: the "Ask Chef" chat generates recipes
// with the LLM, so they must clear the deterministic validator before saving.
// Returns blocking error messages — an empty array means safe to save.
export function validateChatRecipe(parsed: ParsedChatRecipe, dog: DogProfile): string[] {
  return validateIngredients(parsed.ingredients.map(ing => ing.name), dog).errors;
}

export function recipeFromChatJson(parsed: ParsedChatRecipe, dogProfile: DogProfile): Recipe {
  const serving = calcServing(dogProfile);
  const targetDailyGrams = serving.totalDailyGrams || REFERENCE_DAILY_GRAMS;

  // Scale chat-provided ingredient grams (sized for a 30-lb dog per the system
  // prompt) to this dog's actual daily energy need.
  const chatTotalGrams = parsed.ingredients.reduce((sum, ing) => sum + (ing.grams || 0), 0);
  const scaleToDog = chatTotalGrams > 0 ? targetDailyGrams / chatTotalGrams : 1;

  const ingredients: RecipeIngredient[] = parsed.ingredients.map(item => {
    const scaledGrams = Math.max(1, Math.round((item.grams || 0) * scaleToDog));
    const cups = Math.round(gramsToCups(scaledGrams) * 100) / 100;
    return {
      ingredientId: slugifyName(item.name),
      name: item.name,
      category: guessCategory(item.name),
      amountGrams: scaledGrams,
      amountCups: cups > 0 ? cups : undefined,
      groceryFriendlyAmount: groceryLabel(scaledGrams, item.name),
      prepNote: item.prepNote,
    };
  });

  // Default initial batch view = 1 day (matches scaling above). The batch
  // toggle on the detail page lets the user explore 3-day / 7-day yields.
  const batch = calcBatch(serving, '1day');

  const instructions: CookingStep[] = parsed.instructions.map((text, index) => ({
    stepNumber: index + 1,
    instruction: text,
  }));

  const shoppingList: ShoppingListItem[] = ingredients.map(ing => ({
    name: ing.name,
    displayAmount: ing.groceryFriendlyAmount,
    category: ingredientCategoryToShoppingCategory(ing.category),
    note: ing.prepNote,
  }));

  const recipeType: RecipeType = parsed.type;
  const nowIso = new Date().toISOString();

  // Parity with the template-recipe path: run the deterministic validator and
  // build the same safety-note set (validator warnings + standard notes), so a
  // chat-saved recipe isn't left with an empty safetyNotes list. (CHE-81)
  const safety = validateIngredients(parsed.ingredients.map(ing => ing.name), dogProfile);
  const safetyNotes = buildSafetyNotes(recipeType, dogProfile, safety.warnings);

  return {
    id: generateId(),
    dogProfileId: dogProfile.id,
    name: parsed.name.slice(0, 80),
    description: parsed.description || `${parsed.name} — saved from a Cheffo Doggo chat suggestion.`,
    type: recipeType,
    ingredients,
    instructions,
    nutrition: {
      caloriesPerServing: Math.round((targetDailyGrams * 1.1) / Math.max(1, serving.mealsPerDay)),
      caloriesPerDay: Math.round(targetDailyGrams * 1.1),
      isEstimate: true,
    },
    serving,
    batch,
    supplements: [],
    storage: {
      fridgeDays: 4,
      freezerMonths: 2,
      thawInstructions: 'Thaw overnight in the fridge, or place sealed in a bowl of cool water for 20–30 minutes.',
      servingTemperature: 'Serve at room temperature.',
      portioningNotes: 'Portion into airtight containers before refrigerating or freezing.',
    },
    shoppingList,
    safetyNotes,
    vetDisclaimer: GENERAL_VET_DISCLAIMER,
    isFavorite: false,
    scaleFactor: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}
