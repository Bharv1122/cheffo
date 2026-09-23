import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { replaceIngredientReference } from '../src/utils/recipeMutation.ts';

const recipeDetail = await readFile(new URL('../src/pages/Recipes/RecipeDetail.tsx', import.meta.url), 'utf8');
const treatsPage = await readFile(new URL('../src/pages/Treats/index.tsx', import.meta.url), 'utf8');

assert.equal(
  replaceIngredientReference('Cook Turkey Breast thoroughly.', 'Turkey Breast', 'Chicken Breast'),
  'Cook Chicken Breast thoroughly.',
  'ingredient swaps must update cooking instructions',
);
assert.equal(
  replaceIngredientReference('TURKEY BREAST bowl', 'Turkey Breast', 'Chicken Breast'),
  'Chicken Breast bowl',
  'ingredient swaps must be case-insensitive',
);
assert.equal(
  replaceIngredientReference('Use Fish Oil (EPA+DHA).', 'Fish Oil (EPA+DHA)', 'Algal Oil'),
  'Use Algal Oil.',
  'ingredient names with regular-expression characters must be replaced literally',
);

for (const requiredUpdate of [
  'instructions: nextInstructions',
  'nutrition: nextNutrition',
  'shoppingList: [...updatedShoppingIngredients, ...preservedShoppingItems]',
]) {
  assert.ok(recipeDetail.includes(requiredUpdate), `recipe swap is missing derived update: ${requiredUpdate}`);
}

assert.ok(treatsPage.includes('showAll ? TREATS : TREATS.filter'), 'Treats must expand from a category to the full catalog');
assert.ok(treatsPage.includes("[...selected].sort((a, b) => a.name.localeCompare(b.name))"), 'Treats A-Z sort must visibly reorder the selected catalog');
assert.ok(treatsPage.includes("setShowAll(current => !current)"), 'Treats show-all control must toggle both ways');

console.log('Product integrity verified: swaps update derived recipe surfaces; Treats expansion and sorting remain wired.');
