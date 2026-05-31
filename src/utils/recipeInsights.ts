import { getIngredientById } from '../data/ingredients';
import { getIngredientMacroSplit } from '../data/ingredientMacros';
import type { Recipe } from '../types/recipe';

export type RecipePhotoKind = 'chicken' | 'beef' | 'fish' | 'veggie' | 'treats';
export type CommonAllergen = 'chicken' | 'beef' | 'dairy' | 'wheat' | 'soy' | 'eggs';

interface RecipePhotoMeta {
  kind: RecipePhotoKind;
  label: string;
  alt: string;
  src: string;
}

// Real recipe photos used when a generated recipe does not already have its own imageUrl.
// These replace the old SVG/emoji artwork with real food photo fallbacks.
const REAL_RECIPE_PHOTOS: Record<RecipePhotoKind, RecipePhotoMeta> = {
  chicken: {
    kind: 'chicken',
    label: 'Chicken Recipe',
    alt: 'Real food photo of chicken, rice, and vegetables in a bowl',
    src: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1200&q=80',
  },
  beef: {
    kind: 'beef',
    label: 'Beef Recipe',
    alt: 'Real food photo of beef and vegetables in a prepared bowl',
    src: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=1200&q=80',
  },
  fish: {
    kind: 'fish',
    label: 'Fish Recipe',
    alt: 'Real food photo of salmon with vegetables',
    src: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80',
  },
  veggie: {
    kind: 'veggie',
    label: 'Veggie Recipe',
    alt: 'Real food photo of fresh vegetables in a bowl',
    src: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
  },
  treats: {
    kind: 'treats',
    label: 'Treat Recipe',
    alt: 'Real food photo of fresh whole-food dog treat ingredients',
    // NOTE: the previous stock photo here was chocolate-chip cookies — wrong AND
    // alarming on a dog app (chocolate is toxic to dogs). Treats now classify by
    // their actual ingredients (see classifyPhotoKind), so this generic fallback
    // only shows for treats with no protein/veg lead. Points at the same
    // safe whole-food image as `veggie` until a dedicated dog-treat photo (or the
    // AI-generated per-recipe image) is in place.
    src: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=80',
  },
};

const ALLERGEN_RULES: Array<{ allergen: CommonAllergen; pattern: RegExp }> = [
  { allergen: 'chicken', pattern: /\b(chicken|turkey)\b/ },
  { allergen: 'beef', pattern: /\b(beef|lamb|venison)\b/ },
  { allergen: 'dairy', pattern: /\b(dairy|milk|cheese|yogurt|butter|cream)\b/ },
  { allergen: 'wheat', pattern: /\b(wheat|wheat\s*flour|whole\s*wheat|gluten)\b/ },
  { allergen: 'soy', pattern: /\bsoy\b/ },
  { allergen: 'eggs', pattern: /\b(egg|eggs|eggshell)\b/ },
];

const RECIPE_CLASSIFIER_RULES: Array<{ kind: RecipePhotoKind; pattern: RegExp }> = [
  { kind: 'beef', pattern: /\b(beef|lamb|venison)\b/ },
  { kind: 'chicken', pattern: /\b(chicken|turkey|egg)\b/ },
  { kind: 'fish', pattern: /\b(salmon|whitefish|sardine|cod|tilapia|pollock|haddock|fish(?![_\s-]?oil))\b/ },
];

function getRecipeClassifierText(recipe: Recipe): string {
  const rawValues = recipe.ingredients.flatMap(ingredient => {
    const item = getIngredientById(ingredient.ingredientId);
    return [ingredient.ingredientId, ingredient.name, item?.name ?? '', ...(item?.aliases ?? [])];
  });

  return rawValues.join(' ').toLowerCase();
}

function classifyPhotoKind(recipe: Recipe): RecipePhotoKind {
  const classifierText = getRecipeClassifierText(recipe);
  const matchedRule = RECIPE_CLASSIFIER_RULES.find(rule => rule.pattern.test(classifierText));

  // Treats classify by their actual ingredients too — a carrot/sweet-potato
  // treat should look like produce, a chicken-jerky treat like chicken, etc.
  // Falling back to 'veggie' (a safe whole-food image) rather than the old
  // one-size-fits-all baked-cookie photo, which was both inaccurate and showed
  // chocolate (toxic to dogs). The AI-generated per-recipe image, when present,
  // overrides all of this in getRecipePhoto.
  if (recipe.type === 'treat') {
    return matchedRule?.kind ?? 'veggie';
  }

  return matchedRule?.kind ?? 'veggie';
}

export function getRecipePhoto(recipe: Recipe): { src: string; alt: string; kind: RecipePhotoKind; label: string } {
  const kind = classifyPhotoKind(recipe);
  const meta = REAL_RECIPE_PHOTOS[kind];

  if (recipe.imageUrl) {
    return {
      src: recipe.imageUrl,
      alt: `${recipe.name} homemade dog food`,
      kind,
      label: meta.label,
    };
  }

  return {
    src: meta.src,
    alt: meta.alt,
    kind,
    label: meta.label,
  };
}

export function detectRecipeAllergens(recipe: Recipe): CommonAllergen[] {
  const ingredientText = getRecipeClassifierText(recipe);

  const found = ALLERGEN_RULES
    .filter(rule => rule.pattern.test(ingredientText))
    .map(rule => rule.allergen);

  return Array.from(new Set(found));
}

export function getNutritionMacroBreakdown(recipe: Recipe): Array<{ key: 'protein' | 'fat' | 'carb'; label: string; calories: number; percentage: number }> {
  const caloriesByMacro = {
    protein: 0,
    fat: 0,
    carb: 0,
  };

  for (const ingredient of recipe.ingredients) {
    const source = getIngredientById(ingredient.ingredientId);
    const caloriesPerGram = source?.caloriesPerGram ?? 0;

    if (caloriesPerGram <= 0 || !Number.isFinite(caloriesPerGram)) continue;

    const calories = ingredient.amountGrams * caloriesPerGram;
    // Split each ingredient's calories across macros by its composition, so a
    // fatty protein (salmon, lamb) contributes to both protein AND fat rather
    // than dumping 100% of its calories into a single bucket.
    const split = getIngredientMacroSplit(ingredient.ingredientId, ingredient.category);
    caloriesByMacro.protein += calories * split.protein;
    caloriesByMacro.fat += calories * split.fat;
    caloriesByMacro.carb += calories * split.carb;
  }

  const totalCalories = caloriesByMacro.protein + caloriesByMacro.fat + caloriesByMacro.carb;

  const defaultBreakdown = [
    { key: 'protein' as const, label: 'Protein', calories: 0, percentage: 40 },
    { key: 'fat' as const, label: 'Fat', calories: 0, percentage: 30 },
    { key: 'carb' as const, label: 'Carbs', calories: 0, percentage: 30 },
  ];

  if (totalCalories <= 0) {
    return defaultBreakdown;
  }

  const entries = [
    { key: 'protein' as const, label: 'Protein', calories: caloriesByMacro.protein, percentage: 0 },
    { key: 'fat' as const, label: 'Fat', calories: caloriesByMacro.fat, percentage: 0 },
    { key: 'carb' as const, label: 'Carbs', calories: caloriesByMacro.carb, percentage: 0 },
  ];

  entries.forEach(entry => {
    entry.percentage = Math.round((entry.calories / totalCalories) * 100);
  });

  const percentageTotal = entries.reduce((sum, entry) => sum + entry.percentage, 0);
  if (percentageTotal !== 100) {
    const indexWithMostCalories = entries.reduce((best, current, index, arr) =>
      current.calories > arr[best].calories ? index : best
    , 0);

    entries[indexWithMostCalories].percentage += 100 - percentageTotal;
  }

  return entries;
}
