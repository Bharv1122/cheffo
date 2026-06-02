export type RecipeType = 'topper' | 'full_meal' | 'batch_week' | 'pantry' | 'treat';
export type IngredientCategory = 'protein' | 'carb' | 'vegetable' | 'fat' | 'supplement' | 'treat';
export type SupplementCategory = 'calcium' | 'omega3' | 'multivitamin' | 'probiotic' | 'joint';
export type BatchDuration = '1day' | '3day' | '7day';
export type UnitPreference = 'us_volume' | 'metric';

export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  category: IngredientCategory;
  amountGrams: number;
  amountCups?: number;
  amountOz?: number;
  amountMl?: number;
  groceryFriendlyAmount: string;
  displayMetric?: string;
  displayVolume?: string;
  prepNote?: string;
}

export interface CookingStep {
  stepNumber: number;
  instruction: string;
  durationMinutes?: number;
  tip?: string;
}

export interface NutritionEstimate {
  caloriesPerServing: number;
  caloriesPerDay: number;
  isEstimate: true;
  // Treats only: the ACTUAL energy content of one serving (computed from
  // ingredient grams), distinct from caloriesPerServing/caloriesPerDay which
  // for treats represent the dog's SAFE DAILY TREAT BUDGET (the cap), not the
  // energy in the treat. Lets the detail page show both "what's in it" and
  // "how much is safe." Undefined on older treats and on non-treat recipes.
  treatContentPerServing?: number;
}

export interface ServingInfo {
  gramsPerMeal: number;
  cupsPerMeal: number;
  mealsPerDay: number;
  totalDailyGrams: number;
}

export interface BatchInfo {
  totalYieldGrams: number;
  numberOfMeals: number;
  numberOfContainers: number;
  fridgeMeals: number;
  freezerMeals: number;
  // String form like "1day" / "3day" / "7day" / "5day" — widened from
  // BatchDuration to allow arbitrary day counts from the custom batch input
  // on Recipe Detail. Standard values still round-trip cleanly. (CHE-batch)
  usedFor: string;
}

export interface StorageInfo {
  fridgeDays: number;
  freezerMonths: number;
  thawInstructions: string;
  servingTemperature: string;
  portioningNotes: string;
}

export interface SupplementItem {
  name: string;
  category: SupplementCategory;
  isRequired: boolean;
  estimatedAmount?: string;
  vetReviewNote: string;
  exampleProducts?: string[];
}

export interface ShoppingListItem {
  name: string;
  displayAmount: string;
  displayAmountMetric?: string;
  displayAmountVolume?: string;
  category: 'protein' | 'produce' | 'pantry' | 'supplement' | 'equipment';
  estimatedCostUsd?: number;
  note?: string;
}

export interface Recipe {
  id: string;
  dogProfileId: string;
  name: string;
  description: string;
  type: RecipeType;
  ingredients: RecipeIngredient[];
  instructions: CookingStep[];
  nutrition: NutritionEstimate;
  serving: ServingInfo;
  batch: BatchInfo;
  supplements: SupplementItem[];
  storage: StorageInfo;
  shoppingList: ShoppingListItem[];
  safetyNotes: string[];
  imageUrl?: string;
  allergenSafety?: {
    checkedTerms: string[];
    allergenFree: boolean;
    warning?: string;
    matchedIngredients: string[];
  };
  vetDisclaimer: string;
  isFavorite: boolean;
  scaleFactor: 1 | 2 | 3 | 4;
  transitionGuide?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SafetyResult {
  safe: boolean;
  errors: string[];
  warnings: string[];
}
