import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Heart, ShoppingBag, ShoppingCart, ExternalLink, ShieldAlert, ShieldCheck, Package, FileText } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { IngredientCard } from '../../components/ingredients/IngredientCard';
import { SupplementChecklist } from '../../components/supplements/SupplementChecklist';
import { VetApprovalSection } from '../../components/recipe/VetApprovalSection';
import { useRecipes } from '../../hooks/useRecipes';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { useApprovals } from '../../hooks/useApprovals';
import { useUnitPreference } from '../../contexts/UnitPreferenceContext';
import { getIngredientById } from '../../data/ingredients';
import {
  calcBatch,
  cupsToMl,
  formatIngredientByPreference,
  formatMetricIngredient,
  formatVolumeIngredient,
  gramsToCups,
  groceryLabel,
} from '../../utils/calculator';
import { checkSingleIngredient } from '../../utils/safetyValidator';
import { getRecipePhoto } from '../../utils/recipeInsights';
import { computeSuggestedDoses } from '../../utils/supplementDosing';
import { buildInstacartSearchUrl } from '../../utils/affiliate';
import type { Recipe, RecipeIngredient, ShoppingListItem } from '../../types/recipe';

// Quick-select chips for the batch modal. The numeric input below lets the
// vet/user pick any other day count from 1–60. (CHE-batch-custom)
const BATCH_QUICK_DAYS: number[] = [1, 3, 5, 7, 14];
const BATCH_MIN_DAYS = 1;
const BATCH_MAX_DAYS = 60;

// AAFCO adult maintenance minimums on a calorie basis (calories from macro / total).
// Puppies (and pregnant/lactating) need higher protein + fat; we surface a note
// rather than block, since recipe generation already handles life-stage upstream.
const AAFCO_TARGETS = {
  adult: { proteinMinPct: 18, proteinMaxPct: 32, fatMinPct: 11, fatMaxPct: 35 },
  puppy: { proteinMinPct: 22, proteinMaxPct: 32, fatMinPct: 18, fatMaxPct: 35 },
};

function getNutritionBreakdown(recipe: Recipe) {
  const categoryCalories = recipe.ingredients.reduce(
    (acc, ingredient) => {
      const source = getIngredientById(ingredient.ingredientId);
      const calories = source ? source.caloriesPerGram * ingredient.amountGrams : 0;

      if (ingredient.category === 'protein') acc.protein += calories;
      else if (ingredient.category === 'fat' || ingredient.category === 'supplement') acc.fat += calories;
      else acc.carbs += calories;

      if (ingredient.category === 'carb' || ingredient.category === 'vegetable') {
        acc.fiberGrams += ingredient.amountGrams * 0.03;
      }

      return acc;
    },
    { protein: 0, fat: 0, carbs: 0, fiberGrams: 0 }
  );

  const recipeTotalCalories = Math.max(1, categoryCalories.protein + categoryCalories.fat + categoryCalories.carbs);
  const caloriesPerCup = Math.max(1, recipe.nutrition.caloriesPerServing);
  const scale = caloriesPerCup / recipeTotalCalories;

  const proteinCalPerCup = categoryCalories.protein * scale;
  const fatCalPerCup = categoryCalories.fat * scale;
  const carbCalPerCup = categoryCalories.carbs * scale;
  const fiberPerCup = Math.max(0.5, categoryCalories.fiberGrams * scale);

  const proteinGrams = Math.round((proteinCalPerCup / 4) * 10) / 10;
  const fatGrams = Math.round((fatCalPerCup / 9) * 10) / 10;
  const carbsGrams = Math.round((carbCalPerCup / 4) * 10) / 10;

  const proteinPct = Math.round((proteinCalPerCup / caloriesPerCup) * 100);
  const fatPct = Math.round((fatCalPerCup / caloriesPerCup) * 100);
  const carbsPct = Math.round((carbCalPerCup / caloriesPerCup) * 100);

  const caloriesPerDay = Math.round(caloriesPerCup * recipe.serving.cupsPerMeal * recipe.serving.mealsPerDay);

  return {
    caloriesPerCup,
    caloriesPerDay,
    proteinGrams,
    fatGrams,
    carbsGrams,
    fiberGrams: Math.round(fiberPerCup * 10) / 10,
    proteinPct,
    fatPct,
    carbsPct,
  };
}

interface NutritionBreakdown {
  caloriesPerCup: number;
  caloriesPerDay: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  fiberGrams: number;
  proteinPct: number;
  fatPct: number;
  carbsPct: number;
}

interface AafcoCheckResult {
  proteinOk: boolean;
  fatOk: boolean;
  proteinTarget: string;
  fatTarget: string;
}

function evaluateAafco(n: NutritionBreakdown, lifeStage: 'puppy' | 'adult' | 'senior'): AafcoCheckResult {
  // Seniors follow the adult range; puppies get the higher targets.
  const t = lifeStage === 'puppy' ? AAFCO_TARGETS.puppy : AAFCO_TARGETS.adult;
  return {
    proteinOk: n.proteinPct >= t.proteinMinPct && n.proteinPct <= t.proteinMaxPct,
    fatOk: n.fatPct >= t.fatMinPct && n.fatPct <= t.fatMaxPct,
    proteinTarget: `${t.proteinMinPct}–${t.proteinMaxPct}%`,
    fatTarget: `${t.fatMinPct}–${t.fatMaxPct}%`,
  };
}

function formatShoppingItem(item: ShoppingListItem, fallback: string, useMetric: boolean): string {
  if (useMetric) {
    return item.displayAmountMetric ?? fallback;
  }

  return item.displayAmountVolume ?? item.displayAmount ?? fallback;
}

function ingredientCategoryToShoppingCategory(category: RecipeIngredient['category']): ShoppingListItem['category'] {
  if (category === 'protein') return 'protein';
  if (category === 'supplement') return 'supplement';
  if (category === 'carb') return 'pantry';
  return 'produce';
}

function rebuildIngredientDisplay(ingredient: RecipeIngredient): RecipeIngredient {
  const derivedCups = ingredient.amountCups ?? gramsToCups(ingredient.amountGrams);
  const amountCups = ingredient.category === 'supplement' ? ingredient.amountCups : derivedCups;
  const amountMl = ingredient.amountMl ?? (amountCups ? cupsToMl(amountCups) : Math.max(1, Math.round(ingredient.amountGrams)));
  const displayBase = {
    name: ingredient.name,
    category: ingredient.category,
    amountGrams: ingredient.amountGrams,
    amountCups,
    amountMl,
  };

  return {
    ...ingredient,
    amountCups,
    amountMl,
    displayMetric: formatMetricIngredient(displayBase),
    displayVolume: formatVolumeIngredient(displayBase),
    groceryFriendlyAmount: groceryLabel(ingredient.amountGrams, ingredient.name),
  };
}

function normalizeFoodTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findIngredientMatchesByTerms(recipe: Recipe, checkedTerms: string[]): string[] {
  if (!checkedTerms.length) return [];

  const matches = recipe.ingredients
    .filter(ingredient => {
      const ingredientName = normalizeFoodTerm(ingredient.name);
      return checkedTerms.some(term => ingredientName.includes(normalizeFoodTerm(term)));
    })
    .map(ingredient => ingredient.name);

  return Array.from(new Set(matches));
}

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getRecipe, toggleFavorite, updateRecipe } = useRecipes();
  const { getProfile } = useDogProfiles();
  const { unitPreference, setUnitPreference } = useUnitPreference();
  const { primaryApprovalForRecipe } = useApprovals();

  const recipe = id ? getRecipe(id) : undefined;
  const dogProfile = recipe ? getProfile(recipe.dogProfileId) : undefined;
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isShoppingOpen, setIsShoppingOpen] = useState(false);
  // Batch size as an arbitrary day count. Quick-select chips set common
  // values (1/3/5/7/14); the numeric input below lets users pick anything in
  // [BATCH_MIN_DAYS, BATCH_MAX_DAYS]. Display-only — saved recipe data isn't
  // mutated. (CHE-batch-custom)
  const [batchDays, setBatchDays] = useState<number>(1);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // useMemo dropped intentionally — React Compiler auto-memoizes, and the manual
  // useMemo here triggered its preserve-manual-memoization warning on `recipe`.
  const nutrition = recipe ? getNutritionBreakdown(recipe) : null;
  const aafco = nutrition ? evaluateAafco(nutrition, dogProfile?.lifeStage ?? 'adult') : null;

  if (!recipe) {
    return (
      <AppShell active="recipes">
        <section className="doggo-card p-8 text-center">
          <h1 className="text-2xl font-semibold text-[#2b2118]">Recipe not found</h1>
          <p className="mt-2 text-[#7f7469]">This recipe may have been deleted or is no longer available.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/recipes')}>Back to Recipes</Button>
            <Button onClick={() => navigate('/bowl-builder')}>Create New Recipe</Button>
          </div>
        </section>
      </AppShell>
    );
  }

  const currentRecipe = recipe;

  // Swap a single ingredient in place and save immediately — no modal, no
  // draft. Portions are kept; the new ingredient is safety-checked against the
  // dog, and the shopping list is rebuilt. Nutrition recomputes on re-render.
  async function handleInlineSwap(index: number, swapIngredientId: string) {
    if (isSwapping) return;

    const swap = getIngredientById(swapIngredientId);
    if (!swap) {
      setSwapError('Could not find that swap ingredient. Please try a different option.');
      setSwapSuccess(null);
      return;
    }

    const safetyResult = checkSingleIngredient(swap.name, dogProfile);
    if (!safetyResult.safe) {
      setSwapError(safetyResult.errors.join(' '));
      setSwapSuccess(null);
      return;
    }

    const nextIngredients = currentRecipe.ingredients.map((ingredient, ingredientIndex) => {
      if (ingredientIndex !== index) return ingredient;
      return rebuildIngredientDisplay({
        ...ingredient,
        ingredientId: swap.id,
        name: swap.name,
        category: swap.category,
        prepNote: swap.prepNotes,
      });
    });

    const replacedNames = new Set(currentRecipe.ingredients.map(ingredient => ingredient.name.toLowerCase()));
    const updatedShoppingIngredients: ShoppingListItem[] = nextIngredients.map(ingredient => ({
      name: ingredient.name,
      displayAmount: ingredient.displayVolume ?? ingredient.groceryFriendlyAmount,
      displayAmountMetric: ingredient.displayMetric,
      displayAmountVolume: ingredient.displayVolume,
      category: ingredientCategoryToShoppingCategory(ingredient.category),
      note: ingredient.prepNote,
    }));
    const preservedShoppingItems = currentRecipe.shoppingList.filter(item =>
      item.category === 'equipment' || !replacedNames.has(item.name.toLowerCase())
    );

    setIsSwapping(true);
    setSwapError(null);
    try {
      await updateRecipe(currentRecipe.id, {
        ingredients: nextIngredients,
        shoppingList: [...updatedShoppingIngredients, ...preservedShoppingItems],
      });
      setSwapSuccess(`Swapped in ${swap.name} — portions and safety were re-checked.`);
    } catch (error) {
      setSwapError(error instanceof Error ? error.message : 'Could not save the swap. Please try again.');
    } finally {
      setIsSwapping(false);
    }
  }

  const showMetric = unitPreference === 'metric';

  // Active batch — driven by the modal's day toggle. Changing the duration
  // scales ingredient quantities + shopping list amounts on the fly without
  // mutating the saved recipe (the underlying recipe.ingredients are
  // untouched; we derive scaled copies for display).
  const selectedBatch = calcBatch(recipe.serving, batchDays);
  const selectedBatchCups = Math.round((selectedBatch.totalYieldGrams / 240) * 10) / 10;
  const selectedBatchDays = batchDays;
  const scaleFactor = recipe.batch.totalYieldGrams > 0
    ? selectedBatch.totalYieldGrams / recipe.batch.totalYieldGrams
    : 1;
  const isScaled = Math.abs(scaleFactor - 1) > 0.01;

  const scaledIngredients: RecipeIngredient[] = isScaled
    ? recipe.ingredients.map(ingredient => ({
        ...ingredient,
        amountGrams: ingredient.amountGrams * scaleFactor,
        amountCups: ingredient.amountCups !== undefined ? ingredient.amountCups * scaleFactor : undefined,
        amountOz: ingredient.amountOz !== undefined ? ingredient.amountOz * scaleFactor : undefined,
        amountMl: ingredient.amountMl !== undefined ? ingredient.amountMl * scaleFactor : undefined,
        // Drop pre-baked display strings so the formatter recomputes from the
        // scaled amounts instead of returning the original-batch text.
        displayMetric: undefined,
        displayVolume: undefined,
        groceryFriendlyAmount: groceryLabel(ingredient.amountGrams * scaleFactor, ingredient.name),
      }))
    : recipe.ingredients;

  const instructions = recipe.instructions.map(step => step.instruction);
  const ingredientByName = new Map(scaledIngredients.map(item => [item.name, item]));
  const allergenSafety = recipe.allergenSafety;
  const derivedMatchedIngredients = findIngredientMatchesByTerms(recipe, allergenSafety?.checkedTerms ?? []);
  const hasAllergenWarning = allergenSafety?.allergenFree === false || derivedMatchedIngredients.length > 0;
  const recipePhoto = getRecipePhoto(recipe);

  const shoppingListItems = (recipe.shoppingList.length ? recipe.shoppingList : recipe.ingredients.map(ingredient => ({
    name: ingredient.name,
    displayAmount: ingredient.groceryFriendlyAmount,
    category: 'pantry' as const,
  }))).map(item => {
    const fallbackIngredient = ingredientByName.get(item.name);
    const fallback = fallbackIngredient
      ? formatIngredientByPreference(fallbackIngredient, unitPreference)
      : item.displayAmount;

    // When scaled, the saved display strings reflect the original batch, so
    // strip them and let formatShoppingItem use the recomputed fallback.
    const effectiveItem = isScaled && fallbackIngredient
      ? { ...item, displayAmount: fallback, displayAmountMetric: undefined, displayAmountVolume: undefined }
      : item;
    return {
      name: item.name,
      label: formatShoppingItem(effectiveItem, fallback, showMetric),
      category: item.category,
    };
  });
  const shoppingItems = shoppingListItems.map(item => item.label);

  const prepTime = recipe.instructions.find(s => s.stepNumber === 1)?.durationMinutes ?? 15;
  const cookTime = recipe.instructions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0) || 35;
  const dailyCups = Math.max(0.1, recipe.serving.cupsPerMeal * recipe.serving.mealsPerDay);

  const isBatch = recipe.type === 'batch_week';
  const batchLabel = isBatch
    ? `${selectedBatchCups} cups (~${selectedBatchDays} day${selectedBatchDays === 1 ? '' : 's'})`
    : `${selectedBatchCups} cups`;

  return (
    <AppShell
      active="recipes"
      rightRail={
        <>
          <section className="doggo-card p-5">
            <div className="flex items-center gap-3">
              <img src="/cheffo-doggo-logo.png" alt="Cheffo Doggo mascot" className="h-16 w-16 rounded-2xl border border-[#eadfce] bg-[#fff4ea] object-contain p-1" />
              <div>
                <h3 className="text-[1.4rem] font-semibold">Cheffo Doggo's Tip 🐾</h3>
                <p className="mt-1 text-sm text-[#7e7369]">
                  Keep portions consistent: {recipe.serving.cupsPerMeal.toFixed(1)} cup per meal × {recipe.serving.mealsPerDay} meals/day.
                </p>
              </div>
            </div>
          </section>

          <section className="doggo-card p-5">
            <div className="flex items-center justify-between">
              <h4 className="text-[1.25rem] font-semibold">Shopping List</h4>
              <button className="text-sm font-semibold text-[#f97316]">Add All to List</button>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[#6f6459]">
              {shoppingItems.map(item => (
                <li key={item} className="rounded-xl border border-[#eadfce] bg-white px-3 py-2">{item}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-[#d6ebda] bg-[#f2fbf4] p-5 text-sm text-[#4c8b61]">
            <h4 className="font-semibold">Vet Note ✅</h4>
            <p className="mt-2 text-xs leading-relaxed text-[#5f8b6a]">{recipe.vetDisclaimer}</p>
          </section>
        </>
      }
    >
      <button onClick={() => navigate('/recipes')} className="mb-3 text-sm font-semibold text-[#7e7369]">← Back to Recipes</button>

      {hasAllergenWarning && (
        <section className="mb-4 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 text-red-600" size={20} />
            <div>
              <h2 className="text-base font-semibold text-red-800">Safety Warning — Do Not Feed Yet</h2>
              <p className="mt-1 text-sm text-red-700">
                {allergenSafety?.warning ?? 'This recipe may contain ingredients listed in this dog\'s allergies or foods-to-avoid profile.'}
              </p>
              {!!(allergenSafety?.matchedIngredients?.length || derivedMatchedIngredients.length) && (
                <p className="mt-2 text-xs font-medium text-red-700">
                  Matched ingredients: {[...(allergenSafety?.matchedIngredients ?? []), ...derivedMatchedIngredients]
                    .filter((item, index, arr) => arr.indexOf(item) === index)
                    .join(', ')}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {allergenSafety?.allergenFree && (
        <section className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
            <ShieldCheck size={16} />
            Safety-checked for this dog
          </p>
          {allergenSafety.checkedTerms.length > 0 && (
            <p className="mt-1 text-xs text-green-700">
              Checked against: {allergenSafety.checkedTerms.join(', ')}
            </p>
          )}
        </section>
      )}

      {swapSuccess && (
        <section className="mb-4 rounded-2xl border border-[#b6e5c3] bg-[#f0fbf3] px-4 py-3 text-sm font-medium text-[#2f7d4a]">
          {swapSuccess}
        </section>
      )}

      {swapError && (
        <section className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {swapError}
        </section>
      )}

      <section className="doggo-card overflow-hidden p-5">
        <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="overflow-hidden rounded-3xl border border-[#eadfce] bg-[#fff0de]">
              <img
                src={recipePhoto.src}
                alt={recipePhoto.alt}
                className="h-[320px] w-full object-cover"
                loading="eager"
                decoding="async"
              />
            </div>
            <button
              type="button"
              aria-pressed={recipe.isFavorite}
              className={[
                'mt-3 rounded-full px-4 py-1 text-sm font-semibold',
                recipe.isFavorite ? 'bg-[#f97316] text-white' : 'bg-[#fff4ea] text-[#f97316]',
              ].join(' ')}
              onClick={() => void toggleFavorite(recipe.id)}
            >
              ⭐ {recipe.isFavorite ? 'Favorited' : 'Favorite'}
            </button>
          </div>

          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[2.4rem] leading-tight font-semibold text-[#2b2118]">{recipe.name}</h1>
                {/* Prominent vet-approval badge — appears when the recipe has
                    an approved / approved_with_notes approval. (CHE-124) */}
                {(() => {
                  const approval = primaryApprovalForRecipe(recipe.id);
                  if (!approval) return null;
                  const vetLabel = approval.vetName
                    ? `Dr. ${approval.vetName} DVM`
                    : approval.vetEmail;
                  return (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#bfe7cb] bg-[#e9f7ee] px-3 py-1 text-sm font-semibold text-[#235d38]">
                      <ShieldCheck size={16} />
                      <span>Approved by {vetLabel}</span>
                      {approval.status === 'approved_with_notes' && (
                        <span className="text-xs font-normal opacity-80">· with notes</span>
                      )}
                    </div>
                  );
                })()}
                <p className="mt-2 text-[1.05rem] leading-relaxed text-[#7d7268]">{recipe.description}</p>
              </div>
              <button
                className={recipe.isFavorite ? 'mt-2 text-[#f97316]' : 'mt-2 text-[#d9cdbc]'}
                onClick={() => void toggleFavorite(recipe.id)}
                aria-label="Toggle recipe favorite"
              >
                <Heart fill={recipe.isFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f4eef9] p-3 text-sm"><p className="font-semibold">Life Stage</p><p className="text-[#7f7469]">Custom</p></div>
              <div className="rounded-2xl bg-[#fff4ea] p-3 text-sm"><p className="font-semibold">Portion Size</p><p className="text-[#7f7469]">{recipe.serving.cupsPerMeal.toFixed(1)} cup</p></div>
              <div className="rounded-2xl bg-[#fff0f0] p-3 text-sm"><p className="font-semibold">Calories/Cup</p><p className="text-[#7f7469]">{recipe.nutrition.caloriesPerServing} kcal</p></div>
              <div className="rounded-2xl bg-[#eef8ee] p-3 text-sm"><p className="font-semibold">Prep Time</p><p className="text-[#7f7469]">{prepTime} min</p></div>
              <div className="rounded-2xl bg-[#fff4ea] p-3 text-sm"><p className="font-semibold">Cook Time</p><p className="text-[#7f7469]">{cookTime} min</p></div>
              <div className="rounded-2xl bg-[#edf4ff] p-3 text-sm"><p className="font-semibold">Batch Yield</p><p className="text-[#7f7469]">{batchLabel}</p></div>
            </div>

          </div>
        </div>
      </section>

      <section className="mt-4 doggo-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.35rem] font-semibold">Nutrition Facts</h2>
          <span className="rounded-full bg-[#fff1df] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a16b38]">Estimate · per cup</span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-[260px_1fr]">
          {/* kcal cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 lg:grid-cols-1">
            <div className="rounded-2xl border border-[#eadfce] bg-white p-3 text-center">
              <p className="text-3xl font-bold text-[#2b2118]">{nutrition?.caloriesPerCup ?? recipe.nutrition.caloriesPerServing}</p>
              <p className="text-[11px] uppercase tracking-wide text-[#8b8378]">kcal per cup</p>
            </div>
            <div className="rounded-2xl border border-[#eadfce] bg-white p-3 text-center">
              <p className="text-3xl font-bold text-[#2b2118]">{nutrition?.caloriesPerDay ?? '-'}</p>
              <p className="text-[11px] uppercase tracking-wide text-[#8b8378]">kcal per day</p>
            </div>
          </div>

          {/* Macro table */}
          <div className="rounded-2xl border border-[#eadfce] bg-white">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#9a9186]">
              <span>Macro</span>
              <span className="text-right">Grams</span>
              <span className="text-right">% kcal</span>
            </div>
            {[
              { label: 'Protein', g: nutrition?.proteinGrams, pct: nutrition?.proteinPct, ok: aafco?.proteinOk, target: aafco?.proteinTarget },
              { label: 'Fat', g: nutrition?.fatGrams, pct: nutrition?.fatPct, ok: aafco?.fatOk, target: aafco?.fatTarget },
              { label: 'Carbs', g: nutrition?.carbsGrams, pct: nutrition?.carbsPct, ok: undefined, target: undefined },
              { label: 'Fiber', g: nutrition?.fiberGrams, pct: undefined, ok: undefined, target: undefined },
            ].map(row => (
              <div key={row.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-[#f4ead9] px-4 py-2 text-sm text-[#3a302a]">
                <span className="flex items-center gap-2 font-medium">
                  {row.label}
                  {row.ok === true && <span className="text-green-600" title={`AAFCO target ${row.target}`}>✓</span>}
                  {row.ok === false && <span className="text-amber-600" title={`Outside AAFCO target ${row.target}`}>⚠</span>}
                </span>
                <span className="text-right tabular-nums">{row.g ?? '-'}{row.g !== undefined && row.g !== null ? 'g' : ''}</span>
                <span className="text-right tabular-nums text-[#7f7469]">{row.pct !== undefined ? `${row.pct}%` : '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {aafco && (
          <p className="mt-3 text-xs leading-relaxed text-[#7f7469]">
            Checked against AAFCO {dogProfile?.lifeStage === 'puppy' ? 'puppy/growth' : 'adult maintenance'} targets:
            protein {aafco.proteinTarget}, fat {aafco.fatTarget}.
            {!(aafco.proteinOk && aafco.fatOk) && ' One or more macros is outside the typical AAFCO range — confirm completeness with your vet.'}
          </p>
        )}

        <p className="mt-2 text-xs leading-relaxed text-[#7f7469]">
          Homemade diets need supplementation (calcium, omega-3, multivitamin) to be nutritionally complete. See the supplement checklist below.
        </p>
      </section>

      {recipe.supplements.length > 0 && (
        <section className="mt-4 doggo-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[1.35rem] font-semibold">Supplements</h2>
            <span className="rounded-full bg-[#fff1df] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a16b38]">Required for completeness</span>
          </div>
          <div className="mt-3">
            <SupplementChecklist
              supplements={recipe.supplements}
              // Per-dog suggested doses, same math as the vet-approval form
              // so the family sees a starting amount, not just the range.
              // (CHE-122)
              suggestions={dogProfile
                ? computeSuggestedDoses({ recipe, dogWeightLbs: dogProfile.weightLbs })
                : undefined}
              dogName={dogProfile?.name}
            />
          </div>
        </section>
      )}

      <VetApprovalSection recipeId={recipe.id} supplements={recipe.supplements} />

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="doggo-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.35rem] font-semibold">Ingredients</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap rounded-xl border border-[#f2c8a0] bg-[#fff7ee] p-1 text-xs sm:text-sm">
                <button
                  className={[
                    'rounded-lg px-3 py-1.5 font-semibold transition-colors',
                    !showMetric ? 'bg-[#f97316] text-white shadow-sm' : 'text-[#8a7f73] hover:text-[#f97316]',
                  ].join(' ')}
                  onClick={() => setUnitPreference('us_volume')}
                >
                  US Volume (cups/tsp/tbsp)
                </button>
                <button
                  className={[
                    'rounded-lg px-3 py-1.5 font-semibold transition-colors',
                    showMetric ? 'bg-[#f97316] text-white shadow-sm' : 'text-[#8a7f73] hover:text-[#f97316]',
                  ].join(' ')}
                  onClick={() => setUnitPreference('metric')}
                >
                  Metric (grams/ml)
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchOpen(true)}
                aria-haspopup="dialog"
                title="Tap to change the batch size — ingredient amounts scale to match"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#f97316] bg-white px-3 py-1.5 text-xs font-semibold text-[#a16b38] shadow-sm transition-colors hover:bg-[#fff1df] focus:outline-none focus:ring-2 focus:ring-[#f97316]/40 sm:text-sm"
              >
                <Package size={14} />
                <span>
                  Batch size: <span className="text-[#f97316]">{selectedBatchDays} day{selectedBatchDays === 1 ? '' : 's'}</span>
                </span>
                <ChevronDown size={14} className="opacity-70" aria-hidden="true" />
                <span className="sr-only"> — change</span>
              </button>
              <button
                type="button"
                onClick={() => setIsShoppingOpen(true)}
                aria-haspopup="dialog"
                title="View the full grocery shopping list — find each ingredient on Instacart"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#f97316] bg-white px-3 py-1.5 text-xs font-semibold text-[#a16b38] shadow-sm transition-colors hover:bg-[#fff1df] focus:outline-none focus:ring-2 focus:ring-[#f97316]/40 sm:text-sm"
              >
                <ShoppingBag size={14} />
                <span>View full list</span>
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {scaledIngredients.map((ingredient, index) => (
              <IngredientCard
                key={`${ingredient.ingredientId}-${index}`}
                ingredient={ingredient}
                onSwap={swapId => void handleInlineSwap(index, swapId)}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-[#8b8378]">
            Tap an ingredient for swap options — Cheffo Doggo keeps the portion the same and re-checks safety for this dog.
          </p>
        </article>

        <article className="doggo-card p-5">
          <h2 className="text-[1.35rem] font-semibold">Step-by-Step Instructions</h2>
          <ol className="mt-3 space-y-3">
            {instructions.map((step, index) => (
              <li key={`${index}-${step.slice(0, 20)}`} className="flex gap-3 text-sm leading-relaxed text-[#6f6459]">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f97316] text-xs font-semibold text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl border border-[#dce9ff] bg-[#f2f7ff] p-3 text-sm text-[#5574a8]">❄️ Freezer tip: Portion into airtight containers for up to {recipe.storage.freezerMonths} months.</div>
        </article>
      </section>

      <section className="mt-4">
        <article className="doggo-card p-5">
          <h3 className="text-[1.2rem] font-semibold">Storage Instructions</h3>
          <p className="mt-2 text-sm text-[#6f6459]">Refrigerator: store in an airtight container up to {recipe.storage.fridgeDays} days.</p>
          <p className="mt-1 text-sm text-[#6f6459]">Freezer: freeze in 1-cup portions for up to {recipe.storage.freezerMonths} months.</p>
          <p className="mt-1 text-sm text-[#6f6459]">{recipe.storage.thawInstructions}</p>
          {isBatch && (
            <p className="mt-2 text-sm font-medium text-[#f97316]">
              🧊 This batch makes {selectedBatchCups} cups (~{selectedBatchDays} day{selectedBatchDays === 1 ? '' : 's'} at {dailyCups.toFixed(1)} cups/day).
            </p>
          )}
        </article>
      </section>

      <section className="mt-4 doggo-soft-card p-4 text-center text-sm text-[#746a5f]">
        Real ingredients • Paw separators • Smart portions • Happy, healthy dogs • Made with love 🧡
      </section>

      <Modal
        open={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        title="Batch Portions"
        size="lg"
        footer={(
          <div className="flex justify-end">
            <Button onClick={() => setIsBatchOpen(false)}>Got it</Button>
          </div>
        )}
      >
        <p className="text-sm text-[#6f6459]">
          Pick how many days you want to batch-cook for, and we'll show how it breaks down — total yield, meals, and how to split between fridge and freezer.
        </p>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8b8378]">Batch size</p>
          <div
            role="radiogroup"
            aria-label="Batch size — quick select"
            className="mt-2 inline-flex rounded-xl border border-[#eadfce] bg-[#fffaf2] p-1"
          >
            {BATCH_QUICK_DAYS.map(d => {
              const active = batchDays === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setBatchDays(d)}
                  className={[
                    'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                    active ? 'bg-[#f97316] text-white shadow-sm' : 'text-[#8a7f73] hover:text-[#f97316]',
                  ].join(' ')}
                >
                  {d} day{d === 1 ? '' : 's'}
                </button>
              );
            })}
          </div>

          <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#6f6459]">
            <span>Or pick any number of days:</span>
            <input
              type="number"
              min={BATCH_MIN_DAYS}
              max={BATCH_MAX_DAYS}
              step={1}
              value={batchDays}
              onChange={(event) => {
                const raw = parseInt(event.target.value, 10);
                if (!Number.isFinite(raw)) return;
                const clamped = Math.max(BATCH_MIN_DAYS, Math.min(BATCH_MAX_DAYS, Math.round(raw)));
                setBatchDays(clamped);
              }}
              className="w-20 rounded-lg border border-[#eadfce] bg-white px-2 py-1 text-center text-sm font-semibold text-[#2b2118] focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
              aria-label="Custom number of days"
            />
            <span className="text-xs text-[#8b8378]">(1–{BATCH_MAX_DAYS})</span>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#eadfce] bg-[#fff9f0] p-4 text-center">
            <p className="text-2xl font-bold text-[#2b2118]">{selectedBatchCups}</p>
            <p className="text-[11px] uppercase tracking-wide text-[#8b8378]">cups total</p>
            <p className="mt-0.5 text-xs text-[#7f7469]">~{selectedBatch.totalYieldGrams}g</p>
          </div>
          <div className="rounded-2xl border border-[#eadfce] bg-[#fff9f0] p-4 text-center">
            <p className="text-2xl font-bold text-[#2b2118]">{selectedBatch.numberOfMeals}</p>
            <p className="text-[11px] uppercase tracking-wide text-[#8b8378]">total meals</p>
            <p className="mt-0.5 text-xs text-[#7f7469]">{recipe.serving.cupsPerMeal.toFixed(2)} cups each</p>
          </div>
          <div className="rounded-2xl border border-[#eadfce] bg-[#fff9f0] p-4 text-center">
            <p className="text-2xl font-bold text-[#2b2118]">{selectedBatch.numberOfContainers}</p>
            <p className="text-[11px] uppercase tracking-wide text-[#8b8378]">container{selectedBatch.numberOfContainers === 1 ? '' : 's'}</p>
            <p className="mt-0.5 text-xs text-[#7f7469]">covers {selectedBatchDays} day{selectedBatchDays === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#eadfce] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#2b2118]">Storage plan</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[#dce9ff] bg-[#f2f7ff] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5574a8]">🧊 Fridge</p>
              <p className="mt-1 text-lg font-bold text-[#2b2118]">{selectedBatch.fridgeMeals} meal{selectedBatch.fridgeMeals === 1 ? '' : 's'}</p>
              <p className="mt-0.5 text-xs text-[#5f6b85]">Eat within {recipe.storage.fridgeDays} days. Airtight container.</p>
            </div>
            <div className="rounded-xl border border-[#d0e4f0] bg-[#eaf6ff] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#3c6f8a]">🥶 Freezer</p>
              <p className="mt-1 text-lg font-bold text-[#2b2118]">{selectedBatch.freezerMeals} meal{selectedBatch.freezerMeals === 1 ? '' : 's'}</p>
              <p className="mt-0.5 text-xs text-[#456f85]">Up to {recipe.storage.freezerMonths} months. Portion before freezing.</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#7f7469]">
            <strong>Daily plan:</strong> {recipe.serving.cupsPerMeal.toFixed(2)} cups per meal × {recipe.serving.mealsPerDay} meal{recipe.serving.mealsPerDay === 1 ? '' : 's'}/day = <strong>{dailyCups.toFixed(2)} cups per day</strong>{dogProfile?.name ? ` for ${dogProfile.name}` : ''}.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-[#7f7469]">
            <strong>Thawing:</strong> {recipe.storage.thawInstructions}
          </p>
        </div>
      </Modal>

      <Modal
        open={isShoppingOpen}
        onClose={() => setIsShoppingOpen(false)}
        title="Shopping List"
        size="lg"
        footer={(
          <div className="flex justify-end">
            <Button onClick={() => setIsShoppingOpen(false)}>Close</Button>
          </div>
        )}
      >
        <p className="text-sm text-[#6f6459]">
          Amounts match your current batch size ({selectedBatchDays} day{selectedBatchDays === 1 ? '' : 's'}, ~{selectedBatchCups} cups).
          Tap <strong>Find on Instacart</strong> next to any ingredient to search for it — opens in a new tab.
        </p>

        <ul className="mt-4 space-y-2">
          {shoppingListItems.map((item, idx) => (
            <li
              key={`${item.name}-${idx}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eadfce] bg-white px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 text-[#3a302a]">
                {/* Most shopping-list labels already include the ingredient
                    name (e.g. "½ lb Eggs"), but some (supplements with dosing
                    notes) only show the amount — prefix the name when it's
                    missing so each row is legible. */}
                {item.label.toLowerCase().includes(item.name.toLowerCase())
                  ? item.label
                  : `${item.name} — ${item.label}`}
              </span>
              {item.category !== 'equipment' ? (
                <a
                  href={buildInstacartSearchUrl(item.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#43b02a] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#3a9b25] focus:outline-none focus:ring-2 focus:ring-[#43b02a]/40"
                >
                  <ShoppingCart size={12} />
                  <span>Find on Instacart</span>
                  <ExternalLink size={10} className="opacity-80" aria-hidden="true" />
                </a>
              ) : (
                <span className="shrink-0 rounded-full bg-[#f4eddf] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a39689]">
                  Equipment
                </span>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-[#7f7469]">
          Instacart delivers from Whole Foods, Costco, Aldi, Sprouts, and many local stores. Equipment items aren't grocery, so we don't link those.
        </p>
      </Modal>
    </AppShell>
  );
}
