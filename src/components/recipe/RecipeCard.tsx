import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Utensils, ChefHat, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatRecipeType } from '../../utils/formatting';
import { formatIngredientByPreference, recipeGramsPerCup } from '../../utils/calculator';
import { detectRecipeAllergens, getRecipePhoto, type CommonAllergen } from '../../utils/recipeInsights';
import { useUnitPreference } from '../../contexts/UnitPreferenceContext';
import type { Recipe } from '../../types/recipe';

const TYPE_COLORS: Record<string, 'orange' | 'green' | 'amber' | 'blue' | 'gray'> = {
  topper: 'blue',
  full_meal: 'green',
  batch_week: 'amber',
  pantry: 'gray',
  treat: 'orange',
};

const ALLERGEN_LABELS: Record<CommonAllergen, string> = {
  chicken: 'Chicken',
  beef: 'Beef',
  dairy: 'Dairy',
  wheat: 'Wheat',
  soy: 'Soy',
  eggs: 'Eggs',
};

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

interface Props {
  recipe: Recipe;
  dogName?: string;
  onToggleFavorite?: () => void;
}

export function RecipeCard({ recipe, dogName, onToggleFavorite }: Props) {
  const navigate = useNavigate();
  const { unitPreference } = useUnitPreference();
  const recipePhoto = getRecipePhoto(recipe);
  const allergens = detectRecipeAllergens(recipe);
  const visibleAllergens = allergens.slice(0, 2);
  const ingredientPreview = recipe.ingredients
    .slice(0, 2)
    .map(ingredient => formatIngredientByPreference(ingredient, unitPreference))
    .join(' • ');
  const allergenSafety = recipe.allergenSafety;
  const derivedMatchedIngredients = findIngredientMatchesByTerms(recipe, allergenSafety?.checkedTerms ?? []);
  const hasAllergenWarning = allergenSafety?.allergenFree === false || derivedMatchedIngredients.length > 0;
  // Derived from this bowl's real density rather than the saved cupsPerMeal,
  // which assumes a flat 240 g/cup. Must match the recipe detail page or the
  // card and the page it links to quote different scoop sizes.
  const cupsPerMeal = recipe.serving.gramsPerMeal / recipeGramsPerCup(recipe.ingredients);

  return (
    <Card hoverable onClick={() => navigate(`/recipes/${recipe.id}`)} className="overflow-hidden" padding="none">
      <div className="relative h-36 w-full sm:h-40">
        <img src={recipePhoto.src} alt={recipePhoto.alt} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3">
          <p className="text-xs font-medium text-white/90">{recipePhoto.label}</p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={TYPE_COLORS[recipe.type]}>{formatRecipeType(recipe.type)}</Badge>
              {allergenSafety?.allergenFree && (
                <Badge variant="green" icon={<ShieldCheck size={11} />}>
                  Allergen-checked
                </Badge>
              )}
              {hasAllergenWarning && (
                <Badge variant="red" icon={<ShieldAlert size={11} />}>
                  Allergen alert
                </Badge>
              )}
              {dogName && <span className="text-xs text-[#78716C]">for {dogName}</span>}
            </div>
            <h3 className="font-semibold text-[#1C1917] mt-1.5 text-sm leading-snug">{recipe.name}</h3>
            <p className="text-xs text-[#78716C] mt-1 line-clamp-2">{recipe.description}</p>
            {ingredientPreview && (
              <p className="mt-1 text-[11px] text-[#9A8F84] line-clamp-1">Ingredients: {ingredientPreview}</p>
            )}

            {hasAllergenWarning && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700 font-medium">
                ⚠️ {allergenSafety?.warning ?? 'Potential allergen detected for this dog profile. Review ingredients before serving.'}
                {derivedMatchedIngredients.length > 0 && (
                  <span className="block mt-1 text-[10px] font-semibold">
                    Matched: {derivedMatchedIngredients.join(', ')}
                  </span>
                )}
              </div>
            )}

            {allergens.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {visibleAllergens.map(allergen => (
                  <Badge key={allergen} variant="red" icon={<AlertTriangle size={11} />}>
                    {ALLERGEN_LABELS[allergen]}
                  </Badge>
                ))}
                {allergens.length > visibleAllergens.length && (
                  <span className="text-[11px] text-[#B91C1C] font-medium">+{allergens.length - visibleAllergens.length} more</span>
                )}
              </div>
            )}
          </div>

          {onToggleFavorite && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className="shrink-0 p-1.5 rounded-lg hover:bg-[#FDF6E9] transition-colors"
              aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart size={18} className={recipe.isFavorite ? 'fill-[#F97316] text-[#F97316]' : 'text-[#A8A29E]'} />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#78716C]">
          {recipe.type === 'treat' ? (
            <>
              <span className="flex items-center gap-1">
                <Utensils size={13} />
                Treat cap: ~{recipe.nutrition.caloriesPerDay} kcal/day
              </span>
              <span className="flex items-center gap-1">
                <ChefHat size={13} />
                10% daily calories max
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <Utensils size={13} />
                {recipe.serving.mealsPerDay}x/day · {cupsPerMeal.toFixed(1)}c per meal
              </span>
              <span className="flex items-center gap-1">
                <ChefHat size={13} />
                ~{recipe.nutrition.caloriesPerDay} kcal/day (est.)
              </span>
            </>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={e => {
              e.stopPropagation();
              navigate(`/cook/${recipe.id}`);
            }}
          >
            Cook Mode
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={e => {
              e.stopPropagation();
              navigate(`/recipes/${recipe.id}`);
            }}
          >
            View Recipe
          </Button>
        </div>
      </div>
    </Card>
  );
}
