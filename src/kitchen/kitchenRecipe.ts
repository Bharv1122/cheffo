import { useEffect, useState } from 'react';
import type { Recipe } from '../types/recipe';
import { useRecipes } from '../hooks/useRecipes';

export const DEMO_RECIPE_ID = 'demo';

export interface KitchenRecipeSource {
  recipe: Recipe | undefined;
  loading: boolean;
  error: string | null;
  isSample: boolean;
}

// The judges' / visitors' demo path: a real recipe from a vetted template,
// portioned by the same generator the app uses, for a clearly fictional sample
// dog. Generated in the browser — no login, no network, no API cost — and never
// saved anywhere.
export async function buildDemoRecipe(): Promise<Recipe> {
  const [{ generateRecipe }, { buildGuestDogProfile }] = await Promise.all([
    import('../utils/recipeGenerator'),
    import('../utils/guestTreat'),
  ]);
  const dog = { ...buildGuestDogProfile({ name: 'Biscuit (sample dog)', weightLbs: 30, lifeStage: 'adult' }), id: 'kitchen-demo-sample' };
  const recipe = await generateRecipe({
    dog,
    recipeType: 'full_meal',
    forceTemplateId: 'meal_chicken_rice',
    batchDuration: '1day',
    skipImage: true,
  });
  return { ...recipe, id: DEMO_RECIPE_ID, name: `Sample: ${recipe.name}` };
}

export function useDemoKitchenRecipe(): KitchenRecipeSource {
  const [state, setState] = useState<KitchenRecipeSource>({ recipe: undefined, loading: true, error: null, isSample: true });
  useEffect(() => {
    let live = true;
    buildDemoRecipe()
      .then(recipe => { if (live) setState({ recipe, loading: false, error: null, isSample: true }); })
      .catch(() => { if (live) setState({ recipe: undefined, loading: false, error: 'The sample recipe couldn’t load. Reload to try again.', isSample: true }); });
    return () => { live = false; };
  }, []);
  return state;
}

export function useSavedKitchenRecipe(id: string | undefined): KitchenRecipeSource {
  const { getRecipe, loading } = useRecipes();
  const recipe = id ? getRecipe(id) : undefined;
  return { recipe, loading: !recipe && loading, error: null, isSample: false };
}
