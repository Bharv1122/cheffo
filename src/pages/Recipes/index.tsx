import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { useRecipes } from '../../hooks/useRecipes';
import { useApprovals } from '../../hooks/useApprovals';
import { useUnitPreference } from '../../contexts/UnitPreferenceContext';
import { formatIngredientByPreference } from '../../utils/calculator';
import { getRecipePhoto } from '../../utils/recipeInsights';
import type { Recipe } from '../../types/recipe';

type RecipeTab = 'all' | 'full_meal' | 'topper' | 'treat' | 'pantry' | 'favorites' | 'vet_approved';

const TABS: Array<{ key: RecipeTab; label: string }> = [
  { key: 'all', label: 'All Recipes' },
  { key: 'full_meal', label: 'Full Meals' },
  { key: 'topper', label: 'Toppers' },
  { key: 'treat', label: 'Treats' },
  { key: 'pantry', label: 'Pantry Mode' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'vet_approved', label: 'Vet Approved' },
];

function byMostRecent(a: Recipe, b: Recipe): number {
  return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
}

function toFeaturedCard(recipe: Recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    badge: recipe.isFavorite ? 'Favorite' : recipe.type === 'batch_week' ? 'Batch Friendly' : 'Fresh',
    cal: `${recipe.nutrition.caloriesPerServing} kcal/cup`,
    time: `${recipe.instructions.reduce((sum, step) => sum + (step.durationMinutes ?? 5), 0)} min`,
    photo: getRecipePhoto(recipe),
  };
}

function matchesTab(recipe: Recipe, tab: RecipeTab): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'favorites':
      return recipe.isFavorite;
    case 'full_meal':
      return recipe.type === 'full_meal' || recipe.type === 'batch_week';
    case 'topper':
      return recipe.type === 'topper';
    case 'treat':
      return recipe.type === 'treat';
    case 'pantry':
      return recipe.type === 'pantry';
    default:
      return true;
  }
}

export default function RecipesPage() {
  const navigate = useNavigate();
  const { recipes, toggleFavorite, deleteRecipe } = useRecipes();
  const { isApproved } = useApprovals();
  const { unitPreference } = useUnitPreference();
  const [activeTab, setActiveTab] = useState<RecipeTab>('all');

  const filteredRecipes = useMemo(
    () => recipes.filter(recipe =>
      activeTab === 'vet_approved' ? isApproved(recipe.id) : matchesTab(recipe, activeTab)
    ),
    [activeTab, recipes, isApproved]
  );

  // Sidebar "Popular This Week" stays global — it's a showcase, not part of
  // the category view.
  const popularRecipes = useMemo(
    () => [...recipes].sort(byMostRecent).slice(0, 3).map(toFeaturedCard),
    [recipes]
  );

  return (
    <AppShell
      active="recipes"
      rightRail={
        <>
          <section className="doggo-card p-5">
            <h3 className="text-[1.5rem] font-semibold">Why Homemade? 💗</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#7d7268]">
              <li><strong className="text-[#2b2118]">Better Ingredients</strong><br />You control what goes in.</li>
              <li><strong className="text-[#2b2118]">Tailored Nutrition</strong><br />Meals fit your dog's needs.</li>
              <li><strong className="text-[#2b2118]">Stronger Bond</strong><br />Made with love, just for them.</li>
            </ul>
          </section>

          <section className="doggo-card p-5">
            <h4 className="text-[1.25rem] font-semibold">Popular This Week</h4>
            <div className="mt-3 space-y-3 text-sm">
              {popularRecipes.length > 0 ? popularRecipes.map((item, idx) => (
                <button
                  key={item.id}
                  className="flex w-full items-center gap-3 rounded-xl border border-[#eadfce] bg-white p-3 text-left hover:bg-[#fff8ef]"
                  onClick={() => navigate(`/recipes/${item.id}`)}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#fff3e4] text-xs font-bold text-[#f97316]">{idx + 1}</span>
                  <p className="font-medium leading-tight">{item.name}</p>
                </button>
              )) : <p className="text-sm text-[#8b8378]">Generate your first recipe to see trending picks.</p>}
            </div>
          </section>
        </>
      }
    >
      <section className="doggo-soft-card overflow-hidden p-7">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <h1 className="doggo-section-title">Find the Perfect Recipe 💗</h1>
            <p className="mt-2 text-[1.2rem] text-[#7f7469]">Wholesome, homemade meals your dog will love.</p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#675d54]">
              <span>🛡️ Vet-informed every time</span>
              <span>✨ Balanced nutrition in every bite</span>
              <span>🧡 Made with love and real ingredients</span>
            </div>
          </div>
          <img src="/cheffo-doggo-logo.png" alt="Cheffo Doggo mascot" className="mx-auto h-60 w-60 object-contain" />
        </div>
      </section>

      <section className="mt-4 doggo-card p-5">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#eadfce] pb-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={tab.key === activeTab}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold',
                tab.key === activeTab ? 'bg-[#fff0de] text-[#f97316]' : 'text-[#756b60] hover:bg-[#fff7ee]',
              ].join(' ')}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 mb-3 flex items-center justify-between">
          <h2 className="text-[1.4rem] font-semibold">{activeTab === 'favorites' ? 'Favorite Recipes' : 'Your Recipes'} ({filteredRecipes.length})</h2>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => navigate('/wizard')}>Start New Recipe</Button>
        </div>

        {filteredRecipes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#f2c8a0] bg-[#fffaf4] p-6 text-center">
            <h3 className="text-lg font-semibold text-[#2b2118]">No recipes in this category yet</h3>
            <p className="mt-1 text-sm text-[#8b8378]">
              {activeTab === 'favorites'
                ? 'Favorite a recipe from its card or detail page to see it here.'
                : 'Create your first recipe and it will appear here.'}
            </p>
            <Button size="sm" className="mt-3" onClick={() => navigate('/wizard')}>Create Recipe</Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredRecipes.map(recipe => {
              const totalMinutes = recipe.instructions.reduce((sum, step) => sum + (step.durationMinutes ?? 5), 0);
              const ingredientPreview = recipe.ingredients
                .slice(0, 2)
                .map(ingredient => formatIngredientByPreference(ingredient, unitPreference))
                .join(' • ');
              const recipePhoto = getRecipePhoto(recipe);

              return (
                <article
                  key={recipe.id}
                  className="rounded-2xl border border-[#eadfce] bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <button
                    className="w-full text-left"
                    onClick={() => navigate(`/recipes/${recipe.id}`)}
                    aria-label={`Open ${recipe.name}`}
                  >
                    <div className="h-40 overflow-hidden rounded-xl border border-[#eadfce] bg-[#fff4ea]">
                      <img
                        src={recipePhoto.src}
                        alt={recipePhoto.alt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <h3 className="mt-3 text-lg font-semibold leading-tight">{recipe.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-[#8b8378]">{recipe.description}</p>
                    {ingredientPreview && (
                      <p className="mt-2 line-clamp-1 text-xs text-[#9a8f84]">Ingredients: {ingredientPreview}</p>
                    )}
                  </button>
                  <div className="mt-2 flex items-center justify-between text-sm text-[#7d7268]">
                    <span>{recipe.nutrition.caloriesPerServing} kcal/cup</span>
                    <span>{totalMinutes} min</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/recipes/${recipe.id}`)}>View Recipe</Button>
                    <button
                      className={[
                        'grid h-10 w-10 place-items-center rounded-xl border border-[#eadfce] transition-colors',
                        recipe.isFavorite ? 'text-[#f97316] bg-[#fff4ea]' : 'text-[#c5b8a8] hover:text-[#f97316]',
                      ].join(' ')}
                      onClick={() => void toggleFavorite(recipe.id)}
                      aria-label="Toggle recipe favorite"
                      aria-pressed={recipe.isFavorite}
                    >
                      <Heart size={16} fill={recipe.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-xl border border-[#eadfce] text-[#c5b8a8] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      onClick={async () => {
                        if (!window.confirm(`Delete "${recipe.name}"? This can't be undone.`)) return;
                        try {
                          await deleteRecipe(recipe.id);
                        } catch (err) {
                          window.alert(err instanceof Error ? err.message : 'Could not delete recipe.');
                        }
                      }}
                      aria-label={`Delete ${recipe.name}`}
                      title={`Delete ${recipe.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
