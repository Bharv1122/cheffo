// Guest treat preview — the logged-out funnel.
//
// Recipe TEXT in Cheffo is generated entirely client-side from vetted templates
// (recipeGenerator.ts never calls /api/llm for text), so a visitor can see a
// real, correctly-portioned treat recipe for their own dog with no account, no
// server call, and no API cost. That mirrors the Recipe Reborn guest-scan
// funnel, which is the only mechanic either app has that has converted a
// stranger (scan -> signup in 54 seconds, 2026-07-19).
//
// What the guest sees is a PREVIEW, not their free treat: the title, the
// ingredient count and the first two ingredients. Full ingredients, portions,
// instructions, supplements and the shopping list stay behind signup, and the
// one included free treat is still waiting for them once they have an account.

import type { DogProfile, LifeStage } from '../types/dog';
import type { Recipe } from '../types/recipe';
import { generateRecipe } from './recipeGenerator';

export interface GuestDogInput {
  name: string;
  weightLbs: number;
  lifeStage: LifeStage;
}

const GUEST_DOG_STORAGE_KEY = 'cheffo:guest-dog';

/**
 * A representative age for each life stage. The guest only tells us the stage,
 * but the generator needs an age, so we assume a midpoint. Shared with the
 * post-signup profile form so the profile they create matches the assumptions
 * behind the recipe they were just shown — and so the form never displays
 * something self-contradictory like "Senior" next to "1 year old".
 */
export function lifeStageToApproxAge(lifeStage: LifeStage): { ageYears: number; ageMonths: number } {
  if (lifeStage === 'puppy') return { ageYears: 0, ageMonths: 6 };
  if (lifeStage === 'senior') return { ageYears: 9, ageMonths: 0 };
  return { ageYears: 3, ageMonths: 0 };
}

/**
 * Build a throwaway in-memory DogProfile from the three things we ask a guest
 * for. Everything else takes the same defaults the real profile form uses, so
 * the generated treat matches what they'd get after signing up with the same
 * weight and life stage.
 *
 * This profile is never saved — not to Supabase, not to localStorage.
 */
export function buildGuestDogProfile(input: GuestDogInput): DogProfile {
  const now = new Date().toISOString();
  const { ageYears, ageMonths } = lifeStageToApproxAge(input.lifeStage);
  return {
    id: 'guest-preview',
    name: input.name.trim() || 'your dog',
    breed: '',
    ageYears,
    ageMonths,
    weightLbs: input.weightLbs,
    lifeStage: input.lifeStage,
    activityLevel: 'moderate',
    mealsPerDay: 2,
    allergies: [],
    avoidFoods: [],
    medications: [],
    favoriteProteins: [],
    pickyEater: false,
    texturePreference: 'chunky',
    parentSkillLevel: 'beginner',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generate a real treat recipe for a guest. Image generation is skipped because
 * the image proxy is auth-gated — a logged-out visitor would 401 every time.
 */
export async function generateGuestTreat(input: GuestDogInput): Promise<Recipe> {
  return generateRecipe({
    dog: buildGuestDogProfile(input),
    recipeType: 'treat',
    skipImage: true,
  });
}

/**
 * Carry the guest's dog across signup so the profile form they land on is
 * already half-filled instead of blank. Recipe Reborn's equivalent handoff is
 * what fixed its "signups never came back" leak (PR #20).
 */
export function stashGuestDogForSignup(input: GuestDogInput): void {
  try {
    sessionStorage.setItem(GUEST_DOG_STORAGE_KEY, JSON.stringify(input));
  } catch {
    // sessionStorage unavailable (private mode) — signup still works, the
    // profile form just starts empty.
  }
}

/**
 * Read and clear the stashed guest dog. Returns null when there isn't one or
 * the stored value is unusable.
 */
export function consumeGuestDog(): Partial<GuestDogInput> | null {
  try {
    const raw = sessionStorage.getItem(GUEST_DOG_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(GUEST_DOG_STORAGE_KEY);
    const parsed = JSON.parse(raw) as Partial<GuestDogInput>;
    const weight = Number(parsed.weightLbs);
    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      weightLbs: Number.isFinite(weight) && weight > 0 ? weight : undefined,
      lifeStage: parsed.lifeStage,
    };
  } catch {
    return null;
  }
}

/**
 * Additives that commonly show up on a store-bought dog-treat label. Used for
 * the before/after reveal — the same "here's what you're leaving behind" beat
 * that makes the Recipe Reborn funnel land. Kept factual and generic: this is
 * what the category uses, not a claim about any specific brand.
 */
export const COMMON_TREAT_ADDITIVES = [
  'BHA',
  'BHT',
  'Propylene glycol',
  'Corn syrup',
  'Artificial colors',
  'Glycerin',
  'Menadione',
] as const;
