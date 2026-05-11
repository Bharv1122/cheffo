import type { Recipe, RecipeIngredient, RecipeType } from '../types/recipe';

const IMAGE_CACHE_STORAGE_KEY = 'chef-doggo:recipe-image-cache:v1';
const IMAGE_MODEL = import.meta.env.VITE_ABACUS_IMAGE_MODEL ?? 'flux2';
const IMAGE_API_KEY = import.meta.env.VITE_ABACUS_API_KEY;
const ROUTELLM_BASE_URL = import.meta.env.VITE_ABACUS_ROUTELLM_BASE_URL ?? 'https://routellm.abacus.ai/v1';

// Image generation uses Abacus.AI's RouteLLM image format (model "flux2",
// `modalities` + `image_config` request fields). Other OpenAI-compatible
// endpoints (Google's Gemini, OpenRouter, OpenAI direct, etc.) reject those
// fields and return 400. When the base URL clearly isn't pointed at an
// image-capable backend, skip the API call entirely and use the SVG fallback.
function isImageCapableEndpoint(url: string): boolean {
  return url.includes('abacus.ai') || url.includes('routellm');
}

const memoryCache = new Map<string, string>();

function buildFallbackImageDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-label="Chef Doggo default dog food image">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FFF4E5" />
        <stop offset="100%" stop-color="#FDE1BC" />
      </linearGradient>
      <radialGradient id="shine" cx="0.2" cy="0.15" r="0.7">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="1200" height="800" fill="url(#bg)"/>
    <rect width="1200" height="800" fill="url(#shine)"/>
    <ellipse cx="600" cy="620" rx="300" ry="90" fill="rgba(0,0,0,0.15)"/>
    <circle cx="600" cy="410" r="210" fill="#FFFFFF"/>
    <circle cx="600" cy="410" r="160" fill="#FFE8CF"/>
    <text x="600" y="460" font-size="180" text-anchor="middle">🥣</text>
    <text x="600" y="685" fill="#A35A16" font-size="48" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700">Chef Doggo Recipe</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const DEFAULT_RECIPE_IMAGE_URL = buildFallbackImageDataUri();

function getStorageCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(IMAGE_CACHE_STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function setStorageCache(nextCache: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(IMAGE_CACHE_STORAGE_KEY, JSON.stringify(nextCache));
  } catch {
    // Ignore storage quota errors; memory cache still works.
  }
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function toIngredientPhrase(ingredients: RecipeIngredient[]): string {
  const names = ingredients
    .map(ingredient => ingredient.name.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);

  if (names.length === 0) return 'dog-safe whole food ingredients';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;

  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function buildPrompt(recipeName: string, recipeType: RecipeType, ingredients: RecipeIngredient[]): string {
  const ingredientPhrase = toIngredientPhrase(ingredients);

  if (recipeType === 'treat') {
    return `High-quality photo of homemade ${recipeName} dog treats with ${ingredientPhrase}, bite-sized, golden brown, on a clean white plate, realistic, appetizing, professional food photography, warm lighting`;
  }

  return `High-quality photo of ${recipeName} dog food in a ceramic dog bowl with ${ingredientPhrase}, realistic, appetizing, professional food photography, warm lighting`;
}

function extractImageUrl(responseJson: unknown): string | null {
  const data = responseJson as {
    choices?: Array<{
      message?: {
        images?: Array<{
          image_url?: { url?: string };
        }>;
      };
    }>;
  };

  return data.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
}

export function getRecipeImagePrompt(recipe: Pick<Recipe, 'name' | 'type' | 'ingredients'>): string {
  return buildPrompt(recipe.name, recipe.type, recipe.ingredients);
}

export async function generateRecipeImage(recipe: Pick<Recipe, 'name' | 'type' | 'ingredients'>): Promise<string> {
  const prompt = getRecipeImagePrompt(recipe);
  const cacheKey = simpleHash(prompt);

  const inMemory = memoryCache.get(cacheKey);
  if (inMemory) return inMemory;

  const cached = getStorageCache();
  const fromStorage = cached[cacheKey];
  if (fromStorage) {
    memoryCache.set(cacheKey, fromStorage);
    return fromStorage;
  }

  if (!IMAGE_API_KEY || !isImageCapableEndpoint(ROUTELLM_BASE_URL)) {
    return DEFAULT_RECIPE_IMAGE_URL;
  }

  try {
    const response = await fetch(`${ROUTELLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${IMAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image'],
        image_config: {
          num_images: 1,
          aspect_ratio: 'landscape_4_3',
          rewrite_prompt: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image generation failed (${response.status}): ${errorText}`);
    }

    const responseJson = await response.json();
    const imageUrl = extractImageUrl(responseJson);

    if (!imageUrl) {
      throw new Error('Image generation response did not contain an image URL');
    }

    memoryCache.set(cacheKey, imageUrl);
    setStorageCache({ ...cached, [cacheKey]: imageUrl });
    return imageUrl;
  } catch (error) {
    console.error('[RecipeImage] Falling back to default image', error);
    return DEFAULT_RECIPE_IMAGE_URL;
  }
}
