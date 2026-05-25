import { checkToxic } from '../data/toxicIngredients';
import { checkMedicationInteractions } from '../data/medicationInteractions';
import type { DogProfile } from '../types/dog';
import type { SafetyResult } from '../types/recipe';

// Validate a list of ingredient names against the toxic list and dog's profile
export function validateIngredients(
  ingredientNames: string[],
  dog?: DogProfile
): SafetyResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Toxic ingredient check
  const allText = ingredientNames.join(' ');
  const toxicResult = checkToxic(allText);
  errors.push(...toxicResult.errors);
  warnings.push(...toxicResult.warnings);

  // 2. Allergy check
  if (dog?.allergies?.length) {
    for (const allergen of dog.allergies) {
      const allergenLower = allergen.toLowerCase();
      const found = ingredientNames.some(name => name.toLowerCase().includes(allergenLower));
      if (found) {
        errors.push(`"${allergen}" is listed as an allergy for ${dog.name}. Remove this ingredient before proceeding.`);
      }
    }
  }

  // 3. Avoid-foods check (strict safety block)
  const dogWithAliases = dog as DogProfile & { foodsToAvoid?: string[] };
  const avoidFoods = [...(dog?.avoidFoods ?? []), ...(dogWithAliases?.foodsToAvoid ?? [])];

  if (avoidFoods.length) {
    for (const avoid of avoidFoods) {
      const avoidLower = avoid.toLowerCase();
      const found = ingredientNames.some(name => name.toLowerCase().includes(avoidLower));
      if (found) {
        errors.push(`"${avoid}" is on ${dog?.name ?? 'this dog'}'s foods-to-avoid list. Remove this ingredient before proceeding.`);
      }
    }
  }

  // 4. Medication interaction check
  if (dog?.medications?.length) {
    const medResult = checkMedicationInteractions(dog.medications, ingredientNames);
    errors.push(...medResult.errors);
    warnings.push(...medResult.warnings);
  }

  // 5. Life stage flags
  if (dog?.lifeStage === 'puppy') {
    warnings.push(
      'Puppies have special nutritional requirements that differ from adult dogs. Please consult a veterinarian or veterinary nutritionist before feeding homemade food to a puppy.'
    );
  }

  return {
    safe: errors.length === 0,
    errors,
    warnings,
  };
}

// Quick single-ingredient check (for pantry mode entry, ingredient pickers)
export function checkSingleIngredient(name: string, dog?: DogProfile): SafetyResult {
  return validateIngredients([name], dog);
}

// The general vet disclaimer appended to all full-meal recipes
export const GENERAL_VET_DISCLAIMER =
  'Cheffo Doggo provides general educational guidance about homemade dog food. It is not a substitute for veterinary advice. Please consult a licensed veterinarian or veterinary nutritionist before making major changes to your dog\'s diet, especially for puppies, seniors, pregnant or nursing dogs, and dogs with medical conditions or on prescription food. Diet changes should be made gradually over 7–10 days.';

// One-line version for compact surfaces (welcome modal, chat, signup, profile
// form). Always pair surfaces with the long disclaimer if liability is in play
// (recipes, vet export). (CHE-40)
export const SHORT_VET_DISCLAIMER =
  'Cheffo Doggo is educational guidance, not veterinary advice. Always consult a licensed veterinarian for medical decisions about your dog.';

export const SUPPLEMENT_SAFETY_NOTE =
  'Homemade dog food usually needs supplementation to be nutritionally complete. The supplement estimates in this recipe are educational starting points only. Final supplement types, amounts, and products should be confirmed with a licensed veterinarian or veterinary nutritionist.';
