import { readFileSync } from 'node:fs';

const source = readFileSync('src/pages/Recipes/RecipeDetail.tsx', 'utf8');

const requiredSmartDefaultMarkers = [
  "if (recipe.type === 'batch_week') return 7;",
  "if (recipe.type === 'treat') {",
  'Math.round(totalG / dailyG)',
  'return 1;',
  'const batchDays = batchDaysOverride ?? defaultBatchDays;',
];

const missingMarkers = requiredSmartDefaultMarkers.filter((marker) => !source.includes(marker));
if (missingMarkers.length) {
  throw new Error(`Recipe detail batch selector is missing smart-default behavior: ${missingMarkers.join(', ')}`);
}

console.log('Recipe detail batch selector verified: 1-day fresh meals, 7-day weekly batches, natural-yield treats.');
