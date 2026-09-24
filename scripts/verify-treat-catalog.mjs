// Prevent catalog cards from promising a different recipe or hiding ingredients.
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
const {TREAT_CATALOG} = await import('../src/data/treatCatalog.ts');
const {TREAT_TEMPLATES} = await import('../src/data/recipeTemplates.ts');
const {INGREDIENTS} = await import('../src/data/ingredients.ts');
assert.equal(new Set(TREAT_CATALOG.map(card => card.templateId)).size, TREAT_CATALOG.length);
for (const card of TREAT_CATALOG) {
  const template = TREAT_TEMPLATES.find(t => t.id === card.templateId);
  assert.ok(template, `Missing template: ${card.templateId}`);
  assert.equal(card.name, template.name, 'Card and saved recipe names must match');
  const names = Object.keys(template.treatAmountsGrams).map(id => INGREDIENTS.find(i => i.id === id).name);
  assert.deepEqual(card.ingredients, names, `${card.name} must disclose all recipe ingredients`);
  for (const name of names) assert.ok(card.desc.includes(name), `${card.name} omits ${name}`);
  assert.ok(!/dairy.free|nut.free|grain.free|probiotic|antioxidant/i.test(card.desc), 'Avoid separate dietary/health claims');
}
const yogurt = TREAT_CATALOG.find(card => card.templateId === 'treat_yogurt_berry_lickmat');
assert.ok(yogurt.ingredients.includes('Plain Greek Yogurt'), 'The former Dairy-Free card must disclose yogurt');
console.log(`Treat catalog verified: ${TREAT_CATALOG.length} unique recipes with accurate names and ingredient disclosures.`);
