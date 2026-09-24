import { TREAT_TEMPLATES } from './recipeTemplates';
import { INGREDIENTS } from './ingredients';

export type TreatCategory = 'training' | 'frozen' | 'birthday' | 'everyday';

// Cards describe the exact template they open. Ingredient names come from the
// same recipe data; never maintain separate allergen or timing promises here.
const PICKS: Array<{ templateId: string; category: TreatCategory }> = [
  { templateId: 'treat_pumpkin_oat_biscuits', category: 'training' },
  { templateId: 'treat_apple_oat_biscuits', category: 'training' },
  { templateId: 'treat_yogurt_berry_lickmat', category: 'frozen' },
  { templateId: 'treat_strawberry_yogurt_pops', category: 'frozen' },
  { templateId: 'treat_birthday_bowl', category: 'birthday' },
  { templateId: 'treat_pumpkin_pup_cake', category: 'birthday' },
  { templateId: 'treat_pb_banana_bites', category: 'everyday' },
  { templateId: 'treat_frozen_kong', category: 'everyday' },
];

export const TREAT_CATALOG = PICKS.map(pick => {
  const template = TREAT_TEMPLATES.find(item => item.id === pick.templateId);
  if (!template) throw new Error(`Missing treat template: ${pick.templateId}`);
  const ingredientIds = Object.keys(template.treatAmountsGrams ?? {});
  const ingredients = ingredientIds.map(id => {
    const ingredient = INGREDIENTS.find(item => item.id === id);
    if (!ingredient) throw new Error(`Missing treat ingredient: ${id}`);
    return ingredient.name;
  });
  return {
    ...pick,
    name: template.name,
    desc: `Made with ${ingredients.join(', ')}.`,
    ingredients,
    level: template.skillLevel === 'some_experience' ? 'Some experience' : 'Easy',
  };
});

export const FEATURED_TREAT = TREAT_CATALOG[0];
export const BIRTHDAY_TREAT = TREAT_CATALOG.find(item => item.templateId === 'treat_birthday_bowl')!;
