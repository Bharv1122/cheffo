// Keep the toxic-ingredient list catching real hazards without hard-blocking
// safe recipes or safety labels like "Peanut Butter (xylitol-free)".
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const candidate = resolve(dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`);
    if (existsSync(candidate)) return {url: pathToFileURL(candidate).href, shortCircuit: true};
  }
  return nextResolve(specifier, context);
}});
const {TOXIC_INGREDIENTS, checkToxic} = await import('../src/data/toxicIngredients.ts');
const {INGREDIENTS} = await import('../src/data/ingredients.ts');
const {validateIngredients} = await import('../src/utils/safetyValidator.ts');

// One entry per term: no name or alias may appear in two entries.
const seen = new Map();
for (const entry of TOXIC_INGREDIENTS) {
  assert.ok(entry.category && entry.reason, `${entry.name} needs a category and reason`);
  for (const term of [entry.name, ...entry.aliases]) {
    const key = term.toLowerCase();
    assert.ok(!seen.has(key), `"${term}" is in both ${seen.get(key)} and ${entry.name}`);
    seen.set(key, entry.name);
  }
}

// Every catalog ingredient (and so every template) must pass cleanly.
for (const ing of INGREDIENTS) {
  const r = checkToxic(ing.name);
  assert.deepEqual(r.errors, [], `Catalog ingredient "${ing.name}" is hard-blocked`);
  assert.deepEqual(r.warnings, [], `Catalog ingredient "${ing.name}" triggers a warning`);
}
assert.ok(validateIngredients(INGREDIENTS.map(i => i.name)).safe, 'The whole catalog together must pass');

const SAFE_PHRASES = [
  'Peanut Butter (xylitol-free)', 'xylitol free peanut butter', 'sugar-free, no xylitol', 'without garlic', 'no onion',
  'chocolate-free', 'Sweet Potato', 'plain cooked potato', 'Eggs', 'scrambled eggs', 'Apple', 'Cherries (pitted)',
  'Corn kernels', 'Baking soda', 'Bone broth', 'Chicken Liver', 'Cottage Cheese (low-fat, plain)', 'Plain Greek Yogurt',
  'Lamb chops', 'Cooked button mushrooms', 'Watermelon (seedless)', 'Pumpkin (plain)', 'unsalted', 'salt-free broth',
  'Cinnamon', 'Teaspoon of fish oil',
];
for (const phrase of SAFE_PHRASES) {
  assert.deepEqual(checkToxic(phrase).errors, [], `Safe phrase "${phrase}" is hard-blocked`);
}
// A multi-word alias must not match across two separate ingredients.
assert.deepEqual(validateIngredients(['Green Beans', 'Potato']).warnings, [], '"Green Beans" + "Potato" read as "green potato"');

const BLOCKED = [
  'chocolate', 'Raisins', 'grapes', 'onion', 'garlic', 'xylitol', 'birch sugar', 'macadamia', 'beer', 'coffee', 'avocado',
  'pizza dough', 'nutmeg', 'leeks', 'chives', 'green onions', 'hops', 'cherry pits', 'wild mushrooms', 'rhubarb leaves',
  'moldy bread', 'nicotine gum',
];
for (const phrase of BLOCKED) {
  assert.ok(checkToxic(phrase).errors.length > 0, `"${phrase}" should be hard-blocked`);
}
const WARNED = ['salt', 'raw egg', 'corn on the cob', 'cooked bones', 'apple core', 'green potatoes', 'stevia', 'star anise', 'onion powder'];
for (const phrase of WARNED) {
  const r = checkToxic(phrase);
  assert.ok(r.warnings.length > 0, `"${phrase}" should warn`);
}

console.log(`Ingredient safety verified: ${TOXIC_INGREDIENTS.length} entries, ${SAFE_PHRASES.length} safe phrases pass, ${BLOCKED.length} hazards blocked.`);
