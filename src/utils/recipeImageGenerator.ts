import type { Recipe, RecipeIngredient, RecipeType } from '../types/recipe';
import { supabase } from '../lib/supabase';

const IMAGE_CACHE_STORAGE_KEY = 'chef-doggo:recipe-image-cache:v1';

// Image generation goes through the same-origin server proxy (api/llm.ts) — the
// provider key is server-side only. The `?type=image` query routes the proxy to
// the OpenAI-compatible /images/generations endpoint; the body is the OpenAI
// image-gen shape and the response carries base64 image bytes.
const IMAGE_PROXY_URL = '/api/llm?type=image';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

// Kill switch. Image generation is on by default now that the proxy upstream is
// image-capable; set VITE_IMAGE_GEN_ENABLED=false to disable it (e.g. to cut
// paid image costs). Disabled => recipes fall back to a stock photo.
const IMAGE_GEN_ENABLED = import.meta.env.VITE_IMAGE_GEN_ENABLED !== 'false';

// Generated images are re-encoded to JPEG at this width before being stored, so
// the data URI stays small enough to persist inside the recipe record.
const STORED_IMAGE_MAX_WIDTH = 768;
const STORED_IMAGE_JPEG_QUALITY = 0.82;

const memoryCache = new Map<string, string>();

function buildFallbackImageDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-label="Cheffo Doggo default dog food image">
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
    <text x="600" y="685" fill="#A35A16" font-size="48" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700">Cheffo Doggo Recipe</text>
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

function joinNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// Treats are heterogeneous — baked biscuits, frozen yogurt lick-mats,
// dehydrated chews, no-bake fruit bites. A one-size "home-baked treats" prompt
// made the model draw biscuits for everything (e.g. a yogurt lick-mat filler
// rendered as blueberry cookies). Classify the treat's FORM from its name +
// ingredients so the photo matches what the recipe actually is.
type TreatForm = 'frozen' | 'dehydrated' | 'baked' | 'nobake';

function classifyTreatForm(name: string, ingredientNames: string[]): TreatForm {
  const text = `${name} ${ingredientNames.join(' ')}`.toLowerCase();
  if (/lick ?mat|frozen|froze|yogurt|kong|pup ?sicle|popsicle|smoothie|ice|chill/.test(text)) return 'frozen';
  if (/dehydrat|chew|jerky|dried|dry|crisp|crackle/.test(text)) return 'dehydrated';
  if (/biscuit|cookie|bake|baked|muffin|cake|bar|cracker|bites? & oat|oat bites|training (treat|biscuit)/.test(text)) return 'baked';
  // Soft dairy bases with no baking cue read as chilled/soft, not baked.
  if (/yogurt|cottage cheese/.test(ingredientNames.join(' ').toLowerCase())) return 'frozen';
  return 'nobake';
}

// Build a tightly-constrained image prompt. AI image models drift toward
// glamorous human food — garnishes, herb sprigs, plating — when asked for
// "appetizing professional food photography", and they freely swap the
// protein. So the prompt leads with the recipe's actual protein and
// explicitly rules out human-meal styling. (CHE-84)
function buildPrompt(recipeType: RecipeType, ingredients: RecipeIngredient[], name = ''): string {
  const names = ingredients.map(i => i.name.trim().toLowerCase()).filter(Boolean);
  const protein = ingredients.find(i => i.category === 'protein');
  const proteinName = protein?.name.trim().toLowerCase() ?? null;

  if (recipeType === 'treat') {
    const phrase = joinNames(names.slice(0, 5)) || 'dog-safe whole-food ingredients';
    const form = classifyTreatForm(name, names);
    const styleByForm: Record<TreatForm, string> = {
      frozen: `It is a soft, creamy frozen or chilled treat — a smooth mixture of the ingredients above (${phrase}), spooned or spread into a small dish, silicone mold, or onto a rubber lick mat. Match the real ingredients: cottage cheese stays white and lumpy, not smooth yogurt. It is NOT baked: no biscuits, no cookies, no dough, no crust.`,
      dehydrated: 'It is dried, dehydrated treat pieces — thin, leathery, chewy slices of the ingredient on a plain plate. It is NOT baked dough and NOT biscuits.',
      baked: 'Small, simple home-baked biscuits on a plain plate, plain home baking.',
      nobake: 'Small, simple no-bake treat bites or pieces on a plain plate.',
    };
    return `A realistic, plain overhead photo of a homemade dog treat made with ${phrase}. ${styleByForm[form]} Plain pet food — no icing, no decoration, no garnish, no sprinkles. This is pet food, not a human dessert. Natural, even lighting.`;
  }

  const others = names.filter(name => name !== proteinName).slice(0, 4);
  const proteinPart = proteinName ? `plain cooked ${proteinName}` : 'plain cooked meat';
  const mixPart = others.length ? ` mixed with ${joinNames(others)}` : '';
  return `A realistic, plain overhead photo of homemade dog food in a plain stainless steel pet bowl on a kitchen counter. The food is ${proteinPart}${mixPart}, all chopped small and stirred together. It looks like simple, unseasoned, home-cooked pet food — not a fancy meal. No garnish, no fresh herb sprigs, no basil, no bread, no breadsticks, no cheese, no sauce drizzle. This is dog food, not a human restaurant dish. Natural, even lighting.`;
}

// The OpenAI-compat /images/generations response carries base64 image bytes at
// data[].b64_json. Wrap the first one as a PNG data URI.
function extractB64Image(responseJson: unknown): string | null {
  const data = responseJson as { data?: Array<{ b64_json?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  return b64 ? `data:image/png;base64,${b64}` : null;
}

// Re-encode a generated PNG data URI to a smaller JPEG so it can be persisted
// inside the recipe record without bloating storage. Falls back to the original
// data URI if a canvas isn't available or the image can't be decoded.
function downscaleToJpeg(dataUri: string): Promise<string> {
  if (typeof document === 'undefined') return Promise.resolve(dataUri);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, STORED_IMAGE_MAX_WIDTH / (img.width || STORED_IMAGE_MAX_WIDTH));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx || canvas.width === 0 || canvas.height === 0) {
        resolve(dataUri);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL('image/jpeg', STORED_IMAGE_JPEG_QUALITY));
      } catch {
        resolve(dataUri);
      }
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

export function getRecipeImagePrompt(recipe: Pick<Recipe, 'name' | 'type' | 'ingredients'>): string {
  return buildPrompt(recipe.type, recipe.ingredients, recipe.name);
}

// Generate a recipe-specific food photo. Returns a small JPEG data URI on
// success, or null when image generation is disabled or fails — callers should
// leave `imageUrl` unset on null so the recipe falls back to a stock photo.
export async function generateRecipeImage(
  recipe: Pick<Recipe, 'name' | 'type' | 'ingredients'>
): Promise<string | null> {
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

  if (!IMAGE_GEN_ENABLED) return null;

  try {
    // The /api/llm proxy is auth-gated (CHE-14) — attach the user's token.
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(IMAGE_PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt,
        response_format: 'b64_json',
        n: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Image generation failed (${response.status}): ${errorText}`);
    }

    const rawImage = extractB64Image(await response.json());
    if (!rawImage) {
      throw new Error('Image generation response did not contain image data');
    }

    const storedImage = await downscaleToJpeg(rawImage);
    memoryCache.set(cacheKey, storedImage);
    setStorageCache({ ...cached, [cacheKey]: storedImage });
    return storedImage;
  } catch (error) {
    console.error('[RecipeImage] image generation failed — using stock photo fallback', error);
    return null;
  }
}
