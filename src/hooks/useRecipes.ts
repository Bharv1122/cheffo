import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { generateId, storageGet, storageSet } from '../utils/storage';
import type { Recipe } from '../types/recipe';
import type { Json, SavedRecipeInsert, SavedRecipeRow } from '../types/database';

function toRecipe(row: SavedRecipeRow): Recipe {
  const recipe = row.recipe_data as unknown as Recipe;
  return {
    ...recipe,
    id: row.id,
    dogProfileId: row.dog_profile_id,
    name: row.name,
    description: row.description,
    type: row.type,
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSavedRecipeRow(userId: string, recipe: Recipe): SavedRecipeInsert {
  return {
    id: recipe.id,
    user_id: userId,
    dog_profile_id: recipe.dogProfileId,
    name: recipe.name,
    description: recipe.description,
    type: recipe.type,
    recipe_data: recipe as unknown as Json,
    is_favorite: recipe.isFavorite,
    created_at: recipe.createdAt,
    updated_at: recipe.updatedAt,
  };
}

export function useRecipes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const recipesStorageKey = useMemo(() => (userId ? `recipes:${userId}` : 'recipes'), [userId]);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mirror `recipes` into a ref so mutators can read the latest value without
  // listing `recipes` in their useCallback deps — that would churn their
  // identity on every state change and defeat the memoization.
  const recipesRef = useRef(recipes);
  useEffect(() => {
    recipesRef.current = recipes;
  });

  useEffect(() => {
    const client = supabase;
    const currentUserId = userId;

    if (!isSupabaseConfigured || !client || !currentUserId) {
      const localRecipes = storageGet<Recipe[]>(recipesStorageKey) ?? [];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- userId changes on sign-in/out; we must hydrate recipes from local storage in the no-Supabase branch.
      setRecipes(localRecipes);
      setLoading(false);
      return;
    }

    const supabaseClient = client;
    const authenticatedUserId = currentUserId;
    let isMounted = true;

    async function loadRecipes() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabaseClient
        .from('saved_recipes')
        .select('*')
        .eq('user_id', authenticatedUserId)
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setRecipes((data ?? []).map(toRecipe));
      setLoading(false);
    }

    loadRecipes();

    return () => {
      isMounted = false;
    };
  }, [recipesStorageKey, userId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !userId) {
      storageSet(recipesStorageKey, recipes);
    }
  }, [recipes, recipesStorageKey, userId]);

  const saveRecipe = useCallback(async (recipe: Recipe): Promise<Recipe> => {
    const nowIso = new Date().toISOString();
    const normalized: Recipe = {
      ...recipe,
      id: recipe.id || generateId(),
      updatedAt: nowIso,
      createdAt: recipe.createdAt || nowIso,
    };

    const client = supabase;
    if (isSupabaseConfigured && client && userId) {
      const payload = toSavedRecipeRow(userId, normalized);
      const { error: saveError } = await client.from('saved_recipes').upsert(payload, {
        onConflict: 'id',
      });

      if (saveError) {
        throw new Error(saveError.message);
      }
    }

    // Compute next list from the ref so we can both update state and persist
    // synchronously. Doing this only via setRecipes + the persist effect
    // creates a race when callers navigate immediately after saving — the
    // new page reads localStorage before our effect has flushed.
    const current = recipesRef.current;
    const exists = current.some(item => item.id === normalized.id);
    const next = exists
      ? current.map(item => (item.id === normalized.id ? normalized : item))
      : [normalized, ...current];

    if (!isSupabaseConfigured || !supabase || !userId) {
      storageSet(recipesStorageKey, next);
    }
    setRecipes(next);

    return normalized;
  }, [recipesStorageKey, userId]);

  const updateRecipe = useCallback(async (id: string, data: Partial<Recipe>): Promise<void> => {
    const nextRecipe = recipesRef.current.find(recipe => recipe.id === id);
    if (!nextRecipe) return;

    const updated: Recipe = {
      ...nextRecipe,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    const client = supabase;
    if (isSupabaseConfigured && client && userId) {
      const payload = toSavedRecipeRow(userId, updated);
      const { error: updateError } = await client
        .from('saved_recipes')
        .upsert(payload, { onConflict: 'id' });

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    const next = recipesRef.current.map(recipe => (recipe.id === id ? updated : recipe));
    if (!isSupabaseConfigured || !supabase || !userId) {
      storageSet(recipesStorageKey, next);
    }
    setRecipes(next);
  }, [recipesStorageKey, userId]);

  const deleteRecipe = useCallback(async (id: string): Promise<void> => {
    const client = supabase;
    if (isSupabaseConfigured && client && userId) {
      const { error: deleteError } = await client
        .from('saved_recipes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }

    const next = recipesRef.current.filter(recipe => recipe.id !== id);
    if (!isSupabaseConfigured || !supabase || !userId) {
      storageSet(recipesStorageKey, next);
    }
    setRecipes(next);
  }, [recipesStorageKey, userId]);

  const toggleFavorite = useCallback(async (id: string): Promise<void> => {
    const recipe = recipesRef.current.find(item => item.id === id);
    if (!recipe) return;
    await updateRecipe(id, { isFavorite: !recipe.isFavorite });
  }, [updateRecipe]);

  const getRecipe = useCallback((id: string): Recipe | undefined => {
    return recipes.find(recipe => recipe.id === id);
  }, [recipes]);

  const getRecipesByDog = useCallback((dogProfileId: string): Recipe[] => {
    return recipes.filter(recipe => recipe.dogProfileId === dogProfileId);
  }, [recipes]);

  const getFavorites = useCallback((): Recipe[] => {
    return recipes.filter(recipe => recipe.isFavorite);
  }, [recipes]);

  return {
    recipes,
    loading,
    error,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
    toggleFavorite,
    getRecipe,
    getRecipesByDog,
    getFavorites,
  };
}
