import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { coerceGrams } from '../src/utils/chatRecipeAmounts.ts';

// Only the auth dependency is stubbed: the real extraction/parsing code runs.
// These tests do not call the AI service or access an account.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/src/utils/assistantChat.ts')) {
      if (specifier === '../lib/adultConfirmation') return {
        url: 'data:text/javascript,export class AdultConfirmationError extends Error {} export function buildAdultAiHeaders(){throw new Error("Network not permitted in parser tests");}',
        shortCircuit: true,
      };
      if (specifier === './chatRecipeAmounts') return {
        url: new URL('../src/utils/chatRecipeAmounts.ts', import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { heuristicExtractRecipe, normalizeParsedRecipe } = await import('../src/utils/assistantChat.ts');

for (const [input, expected] of [
  ['1 kg', 1000], ['1.5 kilograms', 1500], ['1,000 g', 1000], ['1,234.5 grams', 1235],
  ['200g', 200], [200, 200], ['200', 200], ['.5 kg', 500],
  ['1 1/2 lb', 681], ['1½ lb', 681], ['½ kg', 500], ['3/4 cup', 150],
  ['8 oz', 224], ['1 tbsp', 15], ['1 tsp', 5],
]) assert.equal(coerceGrams(input), expected, String(input));
for (const invalid of ['1,5 kg', '1 fillet', '1 bag', '-1 kg', '1/0 kg', '0 g', '1-2 kg', Infinity, null]) {
  assert.equal(coerceGrams(invalid), null, String(invalid));
}

for (const quantity of ['1 kg', '1,000 g', '1000g']) {
  const recipe = normalizeParsedRecipe({
    name: 'Whitefish bowl', type: 'full_meal',
    ingredients: [{ name: 'Whitefish Fillets', grams: quantity }, { name: 'Zucchini', grams: 400 }],
    instructions: ['Cook the fish thoroughly.', 'Steam zucchini.', 'Combine after cooling.'],
  });
  assert.equal(recipe.ingredients[0].grams, 1000, `structured extraction: ${quantity}`);
  const fallback = heuristicExtractRecipe(`Ingredients:\n- Whitefish Fillets: ${quantity}\n- Zucchini: 400 g\nInstructions:\n1. Cook the fish thoroughly.\n2. Steam zucchini.\n3. Combine after cooling.`);
  assert.ok(fallback, `fallback extracted ${quantity}`);
  assert.equal(fallback.ingredients[0].grams, 1000, `plain-text extraction: ${quantity}`);
}
const decimalLeading = heuristicExtractRecipe('Ingredients:\n1.5 kg whitefish fillets\n400 g zucchini\nInstructions:\n1. Cook fish.\n2. Steam zucchini.\n3. Combine after cooling.');
assert.equal(decimalLeading.ingredients[0].grams, 1500, 'decimal quantity must not be stripped as a list number');
for (const invalid of ['1 fillet', '1,5 kg', '-1 kg']) {
  assert.equal(normalizeParsedRecipe({
    name: 'Incomplete bowl', ingredients: [
      { name: 'Whitefish Fillets', grams: invalid },
      { name: 'Zucchini', grams: 400 }, { name: 'Green Beans', grams: 200 },
    ], instructions: ['Cook thoroughly.'],
  }), null, 'do not silently omit an unreadable protein amount');
  assert.equal(heuristicExtractRecipe(`Ingredients:\nWhitefish Fillets: ${invalid}\nZucchini: 400 g\nGreen Beans: 200 g\nInstructions:\n1. Cook fish.\n2. Steam vegetables.\n3. Combine.`), null, 'fallback must reject an incomplete ingredient list');
}
// Headerless responses (no "Ingredients:" line) must also refuse a bulleted
// ingredient list with an unreadable row, but still accept a clean one.
assert.equal(heuristicExtractRecipe('Here is a bowl for Cooper.\n- Whitefish fillets: 1 fillet\n- Zucchini: 400 g\n- Green beans: 200 g\n\n1. Cook the fish thoroughly.\n2. Steam the vegetables.\n3. Combine after cooling.'), null, 'headerless fallback must reject an incomplete bulleted ingredient list');
const headerless = heuristicExtractRecipe('Here is a bowl for Cooper.\n- Whitefish fillets: 1 kg\n- Zucchini: 400 g\n\n1. Cook the fish thoroughly.\n2. Stir in the zucchini.\n3. Combine after cooling.');
assert.ok(headerless, 'headerless fallback still accepts a complete list');
assert.equal(headerless.ingredients[0].grams, 1000, 'headerless whitefish amount');
console.log('Chat quantity regression checks passed: kilograms, grouped grams, fractions, malformed units and both extraction paths.');
