import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Heart, Play, ShoppingBag, Timer, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { IngredientCard } from '../../components/ingredients/IngredientCard';
import { useRecipes } from '../../hooks/useRecipes';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { useUnitPreference } from '../../contexts/UnitPreferenceContext';
import { getIngredientById } from '../../data/ingredients';
import {
  cupsToMl,
  formatIngredientByPreference,
  formatMetricIngredient,
  formatVolumeIngredient,
  gramsToCups,
  groceryLabel,
} from '../../utils/calculator';
import { checkSingleIngredient } from '../../utils/safetyValidator';
import { getRecipePhoto } from '../../utils/recipeInsights';
import type { Recipe, RecipeIngredient, ShoppingListItem } from '../../types/recipe';

function getBatchDays(recipe: Recipe): number {
  const dailyCups = Math.max(0.1, recipe.serving.cupsPerMeal * recipe.serving.mealsPerDay);
  const totalCups = recipe.batch.totalYieldGrams / 240;
  return totalCups / dailyCups;
}

function getSubstitutions(recipe: Recipe): Array<{ from: string; to: string }> {
  return recipe.ingredients
    .slice(0, 3)
    .map(ingredient => {
      const source = getIngredientById(ingredient.ingredientId);
      if (!source?.possibleSwaps?.length) {
        return null;
      }

      const swapLabels = source.possibleSwaps
        .map(swapId => getIngredientById(swapId)?.name)
        .filter(Boolean)
        .slice(0, 2)
        .join(' or ');

      if (!swapLabels) return null;
      return { from: source.name, to: swapLabels };
    })
    .filter((item): item is { from: string; to: string } => Boolean(item));
}

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

  return {
    caloriesPerCup,
    proteinGrams,
    fatGrams,
    carbsGrams,
    fiberGrams: Math.round(fiberPerCup * 10) / 10,
    proteinPct: Math.round((proteinCalPerCup / caloriesPerCup) * 100),
    fatPct: Math.round((fatCalPerCup / caloriesPerCup) * 100),
    carbsPct: Math.round((carbCalPerCup / caloriesPerCup) * 100),
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

  const recipe = id ? getRecipe(id) : undefined;
  const dogProfile = recipe ? getProfile(recipe.dogProfileId) : undefined;
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [draftIngredients, setDraftIngredients] = useState<RecipeIngredient[]>([]);
  const [customizeError, setCustomizeError] = useState<string | null>(null);
  const [customizeSuccess, setCustomizeSuccess] = useState<string | null>(null);
  const [isSavingCustomization, setIsSavingCustomization] = useState(false);

  const substitutions = useMemo(() => (recipe ? getSubstitutions(recipe) : []), [recipe]);
  const nutrition = useMemo(() => (recipe ? getNutritionBreakdown(recipe) : null), [recipe]);

  if (!recipe) {
    return (
      <AppShell active="recipes">
        <section className="doggo-card p-8 text-center">
          <h1 className="text-2xl font-semibold text-[#2b2118]">Recipe not found</h1>
          <p className="mt-2 text-[#7f7469]">This recipe may have been deleted or is no longer available.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/recipes')}>Back to Recipes</Button>
            <Button onClick={() => navigate('/wizard')}>Create New Recipe</Button>
          </div>
        </section>
      </AppShell>
    );
  }

  const currentRecipe = recipe;

  function openCustomizeIngredients() {
    setDraftIngredients(currentRecipe.ingredients.map(ingredient => ({ ...ingredient })));
    setCustomizeError(null);
    setCustomizeSuccess(null);
    setIsCustomizeOpen(true);
  }

  function handleSwapIngredient(index: number, swapIngredientId: string) {
    const swapIngredient = getIngredientById(swapIngredientId);
    if (!swapIngredient) {
      setCustomizeError('Could not find that swap ingredient. Please try a different option.');
      return;
    }

    const safetyResult = checkSingleIngredient(swapIngredient.name, dogProfile);
    if (!safetyResult.safe) {
      setCustomizeError(safetyResult.errors.join(' '));
      return;
    }

    setDraftIngredients(prev => prev.map((ingredient, ingredientIndex) => {
      if (ingredientIndex !== index) return ingredient;

      const nextIngredient = rebuildIngredientDisplay({
        ...ingredient,
        ingredientId: swapIngredient.id,
        name: swapIngredient.name,
        category: swapIngredient.category,
        prepNote: swapIngredient.prepNotes,
      });

      return nextIngredient;
    }));

    setCustomizeError(null);
  }

  async function handleSaveCustomIngredients() {
    if (!draftIngredients.length) {
      setCustomizeError('Please keep at least one ingredient in the recipe.');
      return;
    }

    const firstUnsafeIngredient = draftIngredients
      .map(ingredient => ({ ingredient, result: checkSingleIngredient(ingredient.name, dogProfile) }))
      .find(entry => !entry.result.safe);

    if (firstUnsafeIngredient) {
      setCustomizeError(firstUnsafeIngredient.result.errors.join(' '));
      return;
    }

    const normalizedIngredients = draftIngredients.map(rebuildIngredientDisplay);
    const ingredientNames = new Set(currentRecipe.ingredients.map(ingredient => ingredient.name.toLowerCase()));

    const updatedShoppingIngredients: ShoppingListItem[] = normalizedIngredients.map(ingredient => ({
      name: ingredient.name,
      displayAmount: ingredient.displayVolume ?? ingredient.groceryFriendlyAmount,
      displayAmountMetric: ingredient.displayMetric,
      displayAmountVolume: ingredient.displayVolume,
      category: ingredientCategoryToShoppingCategory(ingredient.category),
      note: ingredient.prepNote,
    }));

    const preservedShoppingItems = currentRecipe.shoppingList.filter(item =>
      item.category === 'equipment' || !ingredientNames.has(item.name.toLowerCase())
    );

    setIsSavingCustomization(true);
    try {
      await updateRecipe(currentRecipe.id, {
        ingredients: normalizedIngredients,
        shoppingList: [...updatedShoppingIngredients, ...preservedShoppingItems],
      });
      setCustomizeSuccess('Ingredients updated successfully.');
      setIsCustomizeOpen(false);
    } catch (error: any) {
      setCustomizeError(error?.message ?? 'Could not save ingredient changes. Please try again.');
    } finally {
      setIsSavingCustomization(false);
    }
  }

  const showMetric = unitPreference === 'metric';
  const ingredients = recipe.ingredients.map(ingredient => formatIngredientByPreference(ingredient, unitPreference));
  const instructions = recipe.instructions.map(step => step.instruction);
  const ingredientByName = new Map(recipe.ingredients.map(item => [item.name, item]));
  const allergenSafety = recipe.allergenSafety;
  const derivedMatchedIngredients = findIngredientMatchesByTerms(recipe, allergenSafety?.checkedTerms ?? []);
  const hasAllergenWarning = allergenSafety?.allergenFree === false || derivedMatchedIngredients.length > 0;
  const recipePhoto = getRecipePhoto(recipe);

  const shoppingItems = (recipe.shoppingList.length ? recipe.shoppingList : recipe.ingredients.map(ingredient => ({
    name: ingredient.name,
    displayAmount: ingredient.groceryFriendlyAmount,
    category: 'pantry' as const,
  }))).map(item => {
    const fallbackIngredient = ingredientByName.get(item.name);
    const fallback = fallbackIngredient
      ? formatIngredientByPreference(fallbackIngredient, unitPreference)
      : item.displayAmount;

    return formatShoppingItem(item, fallback, showMetric);
  });

  const batchYieldCups = Math.round((recipe.batch.totalYieldGrams / 240) * 10) / 10;
  const prepTime = recipe.instructions.find(s => s.stepNumber === 1)?.durationMinutes ?? 15;
  const cookTime = recipe.instructions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0) || 35;
  const dailyCups = Math.max(0.1, recipe.serving.cupsPerMeal * recipe.serving.mealsPerDay);

  const isBatch = recipe.type === 'batch_week';
  const batchDays = isBatch ? getBatchDays(recipe) : 0;
  const batchLabel = isBatch
    ? `${batchYieldCups} cups (~${batchDays.toFixed(1)} days)`
    : `${batchYieldCups} cups`;

  return (
    <AppShell
      active="recipes"
      rightRail={
        <>
          <section className="doggo-card p-5">
            <div className="flex items-center gap-3">
              <img src="/chef-doggo-logo.webp" alt="Chef Doggo mascot" className="h-16 w-16 rounded-2xl border border-[#eadfce] bg-[#fff4ea] object-contain p-1" />
              <div>
                <h3 className="text-[1.4rem] font-semibold">Chef Doggo's Tip 🐾</h3>
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

          <section className="doggo-card p-5">
            <h4 className="text-[1.25rem] font-semibold">Nutrition (per cup)</h4>
            <div className="mt-3 rounded-2xl border border-[#eadfce] bg-white p-4">
              <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-8 border-[#f7d09f] text-center">
                <div>
                  <p className="text-2xl font-bold">{nutrition?.caloriesPerCup ?? recipe.nutrition.caloriesPerServing}</p>
                  <p className="text-xs text-[#8b8378]">kcal</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-[#6f6459]">
                <li>Protein: {nutrition?.proteinGrams ?? '-'}g ({nutrition?.proteinPct ?? '-'}%)</li>
                <li>Fat: {nutrition?.fatGrams ?? '-'}g ({nutrition?.fatPct ?? '-'}%)</li>
                <li>Carbs: {nutrition?.carbsGrams ?? '-'}g ({nutrition?.carbsPct ?? '-'}%)</li>
                <li>Fiber: {nutrition?.fiberGrams ?? '-'}g</li>
              </ul>
            </div>
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
              <h2 className="text-base font-semibold text-red-800">Allergen Warning — Do Not Feed Yet</h2>
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
            Allergen-checked for this dog
          </p>
          {allergenSafety.checkedTerms.length > 0 && (
            <p className="mt-1 text-xs text-green-700">
              Checked against: {allergenSafety.checkedTerms.join(', ')}
            </p>
          )}
        </section>
      )}

      {customizeSuccess && (
        <section className="mb-4 rounded-2xl border border-[#b6e5c3] bg-[#f0fbf3] px-4 py-3 text-sm font-medium text-[#2f7d4a]">
          {customizeSuccess}
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

            <div className="mt-5 flex flex-wrap gap-2">
              <Button icon={<Play size={15} />} onClick={() => navigate(`/cook/${recipe.id}`)}>Start Cooking</Button>
              <Button variant="secondary" icon={<Timer size={15} />}>Start Voice Cooking</Button>
              <Button variant="secondary" icon={<ShoppingBag size={15} />}>View Full List</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="doggo-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[1.35rem] font-semibold">Ingredients</h2>
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
          </div>
          <ul className="mt-3 space-y-2 text-sm text-[#6f6459]">
            {ingredients.map(item => (
              <li key={item} className="rounded-xl border border-[#eadfce] bg-white px-3 py-2">{item}</li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-3 rounded-xl border border-[#f2c8a0] px-4 py-2 text-sm font-semibold text-[#f97316] hover:bg-[#fff6ec]"
            onClick={openCustomizeIngredients}
          >
            Customize Ingredients
          </button>
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

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="doggo-card p-5">
          <h3 className="text-[1.2rem] font-semibold">Storage Instructions</h3>
          <p className="mt-2 text-sm text-[#6f6459]">Refrigerator: store in an airtight container up to {recipe.storage.fridgeDays} days.</p>
          <p className="mt-1 text-sm text-[#6f6459]">Freezer: freeze in 1-cup portions for up to {recipe.storage.freezerMonths} months.</p>
          <p className="mt-1 text-sm text-[#6f6459]">{recipe.storage.thawInstructions}</p>
          {isBatch && (
            <p className="mt-2 text-sm font-medium text-[#f97316]">
              🧊 This batch makes {batchYieldCups} cups (~{batchDays.toFixed(1)} days at {dailyCups.toFixed(1)} cups/day).
            </p>
          )}
        </article>

        <article className="doggo-card p-5">
          <h3 className="text-[1.2rem] font-semibold">Substitution Suggestions</h3>
          <div className="mt-3 space-y-2 text-sm text-[#6f6459]">
            {substitutions.length > 0 ? substitutions.map(item => (
              <div key={item.from} className="rounded-xl border border-[#eadfce] bg-white p-2">{item.from} → {item.to}</div>
            )) : (
              <p className="text-sm text-[#8b8378]">No substitutions available for this recipe yet.</p>
            )}
          </div>
        </article>
      </section>

      <section className="mt-4 doggo-soft-card p-4 text-center text-sm text-[#746a5f]">
        Real ingredients • Paw separators • Smart portions • Happy, healthy dogs • Made with love 🧡
      </section>

      <Modal
        open={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        title="Customize Ingredients"
        size="lg"
        footer={(
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setDraftIngredients(currentRecipe.ingredients.map(ingredient => ({ ...ingredient })));
                setCustomizeError(null);
              }}
            >
              Reset
            </Button>
            <Button variant="secondary" onClick={() => setIsCustomizeOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSaveCustomIngredients()} loading={isSavingCustomization}>Save Changes</Button>
          </div>
        )}
      >
        <p className="text-sm text-[#6f6459]">
          Tap any ingredient to see substitution options. Chef Doggo will keep portions the same and re-check safety against this dog's profile.
        </p>

        {customizeError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {customizeError}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {draftIngredients.map((ingredient, index) => (
            <IngredientCard
              key={`${ingredient.ingredientId}-${index}`}
              ingredient={ingredient}
              onSwap={swapId => handleSwapIngredient(index, swapId)}
            />
          ))}
        </div>
      </Modal>
    </AppShell>
  );
}
