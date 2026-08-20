// Regression guard for the batch-scaling portion bugs (Aug 2026).
//
// Symptom that started this: a 7-day pantry bowl printed "3 ½ cups" for ground
// turkey, green beans, carrots AND sweet potato — four very different volumes —
// while labelling 675 g of turkey as "1 lb".
//
// Two independent causes, both guarded here:
//   1. RecipeDetail scaled the SAVED amountCups by the batch factor. amountCups
//      is rounded to the nearest ¼ cup at 1-day scale, where almost every
//      ingredient lands in the same 0.5-cup bucket, so ×7 turned that shared
//      rounding artifact into four identical (and wrong) figures.
//   2. formatImperialWeight / groceryLabel snapped whole ranges onto one label
//      (everything from 0.9 to 1.8 lb printed "1 lb").
//
// Runs the REAL source: Node strips the TypeScript, and a resolve hook supplies
// the extensions that Vite normally adds.

import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const base = dirname(fileURLToPath(context.parentURL));
      for (const candidate of [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`]) {
        const absolute = resolvePath(base, candidate);
        if (existsSync(absolute)) {
          return { url: pathToFileURL(absolute).href, shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const {
  formatImperialWeight,
  formatVolumeIngredient,
  gramsToCups,
  gramsPerCupForIngredient,
  groceryLabel,
  recipeGramsPerCup,
  calorieTargetWeightLbs,
  calcDER,
  calcServing,
} = await import('../src/utils/calculator.ts');

const failures = [];
function check(label, actual, expected) {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected;
  if (!ok) failures.push(`${label}\n    expected: ${expected}\n    actual:   ${actual}`);
}

// ── 1. Weight labels round continuously ───────────────────────────────────────
// The exact case from the bug report: 675 g of ground turkey.
check('675 g reads as 1½ lb, not "1 lb"', formatImperialWeight(675), '1 ½ lbs');
check('787 g reads as 1¾ lb', formatImperialWeight(787), '1 ¾ lbs');
check('454 g still reads as 1 lb', formatImperialWeight(454), '1 lb');
check('440 g rounds up to 1 lb, not "16 oz"', formatImperialWeight(440), '1 lb');
check('300 g reads in ounces', formatImperialWeight(300), '11 oz');
check('groceryLabel shares the ladder', groceryLabel(675, 'Ground Turkey'), 'about 1 ½ lbs Ground Turkey');

// No label may under-report by more than a quarter pound (the rounding step).
for (let grams = 20; grams <= 4000; grams += 7) {
  const label = formatImperialWeight(grams);
  const [, whole, fraction, unit] = label.match(/^(\d+)(?: ([¼½¾]))? (lbs?|oz|g)$/) ?? [];
  if (!unit) {
    failures.push(`formatImperialWeight(${grams}) produced an unparseable label: "${label}"`);
    break;
  }
  const fractionValue = { '¼': 0.25, '½': 0.5, '¾': 0.75 }[fraction] ?? 0;
  const value = Number(whole) + fractionValue;
  const labelGrams = unit === 'g' ? value : unit === 'oz' ? value * 28.35 : value * 453.592;
  const errorGrams = Math.abs(labelGrams - grams);
  if (errorGrams > 453.592 / 8 + 0.5) {
    failures.push(`formatImperialWeight(${grams}) = "${label}" is off by ${Math.round(errorGrams)} g`);
    break;
  }
}

// ── 2. Density resolves through synthetic ids ─────────────────────────────────
// Chat- and pantry-built recipes store ids like "chat:sweet-potatoes" that miss
// the density map; the ingredient NAME has to rescue the lookup.
check('catalog id resolves', gramsPerCupForIngredient('ground_turkey', 'Ground Turkey'), 225);
check('chat: id falls back to the name', gramsPerCupForIngredient('chat:carrots', 'Carrots'), 128);
check('pantry: id falls back to the name', gramsPerCupForIngredient('pantry:green_beans', 'Green Beans'), 125);
check('plural free text still resolves', gramsPerCupForIngredient('chat:sweet-potatoes', 'Sweet Potatoes'), 240);
check('unknown food uses water density', gramsPerCupForIngredient('chat:mystery-goo', 'Mystery Goo'), 240);

// ── 3. Scaling grams then rounding != rounding then scaling ───────────────────
// The reported bowl: a 434 g/day pantry mix viewed at a 7-day batch size.
const DAY_GRAMS = { ground_turkey: 96, eggs: 96, green_beans: 48, carrots: 48, sweet_potato: 145 };
const NAMES = {
  ground_turkey: 'Ground Turkey',
  eggs: 'Egg',
  green_beans: 'Green Beans',
  carrots: 'Carrots',
  sweet_potato: 'Sweet Potatoes',
};
const DAYS = 7;

const correctCups = {};
const buggyCups = {};
for (const [id, dayGrams] of Object.entries(DAY_GRAMS)) {
  const perCup = gramsPerCupForIngredient(id, NAMES[id]);
  correctCups[id] = gramsToCups(dayGrams * DAYS, perCup);
  buggyCups[id] = gramsToCups(dayGrams, perCup) * DAYS; // the old code path
}

check(
  'the old path collapsed four different volumes onto one figure',
  new Set(Object.values(buggyCups)).size,
  1
);
check(
  'the fixed path spreads them back out',
  new Set(Object.values(correctCups)).size,
  size => size >= 3
);
check('turkey: 672 g is 3 cups, not 3½', correctCups.ground_turkey, 3);
check('green beans: 336 g is 2¾ cups', correctCups.green_beans, 2.75);
check('carrots: 336 g is 2¾ cups', correctCups.carrots, 2.75);
check('sweet potato: 1015 g is 4¼ cups', correctCups.sweet_potato, 4.25);
// The headline distortion: the old display hid that sweet potato is by far the
// bulkiest thing in the bowl by printing it at the same 3½ cups as everything
// else. It is really ~40% more volume than the turkey.
check(
  'sweet potato is now visibly the largest component',
  correctCups.sweet_potato / correctCups.ground_turkey,
  ratio => ratio > 1.35
);
check('old display hid that entirely', buggyCups.sweet_potato / buggyCups.ground_turkey, 1);

// Every ingredient's scaled volume must stay within a quarter cup of the truth.
for (const [id, dayGrams] of Object.entries(DAY_GRAMS)) {
  const perCup = gramsPerCupForIngredient(id, NAMES[id]);
  const truth = (dayGrams * DAYS) / perCup;
  if (Math.abs(correctCups[id] - truth) > 0.125 + 1e-9) {
    failures.push(`${NAMES[id]}: scaled cups ${correctCups[id]} drifted from ${truth.toFixed(2)}`);
  }
}

// ── 4. Serving cups reconcile with the ingredient list ────────────────────────
// "This batch makes N cups" and "X cups per day" must both come from the bowl's
// real density, or the page contradicts the amounts printed directly above it.
const ingredients = Object.entries(DAY_GRAMS).map(([id, grams]) => ({
  ingredientId: id,
  name: NAMES[id],
  amountGrams: grams,
}));
const bowlGramsPerCup = recipeGramsPerCup(ingredients);
const totalDailyGrams = Object.values(DAY_GRAMS).reduce((a, b) => a + b, 0);

check('mixed bowl is denser than water-density guess', bowlGramsPerCup, v => v > 185 && v < 210);

const dailyCupsFromDensity = totalDailyGrams / bowlGramsPerCup;
const dailyCupsFromIngredients = Object.entries(DAY_GRAMS)
  .reduce((sum, [id, grams]) => sum + grams / gramsPerCupForIngredient(id, NAMES[id]), 0);
check(
  'daily cups match the sum of the per-ingredient cups',
  Math.abs(dailyCupsFromDensity - dailyCupsFromIngredients) < 0.01,
  true
);
check(
  'the flat 240 g/cup assumption understated the scoop by >15%',
  (dailyCupsFromDensity - totalDailyGrams / 240) / dailyCupsFromDensity,
  v => v > 0.15
);

// ── 5. The protein card shows volume AND an honest weight ─────────────────────
const turkeyCard = formatVolumeIngredient({
  name: 'Ground Turkey',
  category: 'protein',
  amountGrams: 672,
  amountCups: correctCups.ground_turkey,
});
check('protein card', turkeyCard, '3 cups Ground Turkey (1 ½ lbs)');

// ── 6. Ideal weight drives calorie-target portions ───────────────────────────
const cooper = {
  weightLbs: 45,
  idealWeightLbs: 40,
  lifeStage: 'adult',
  activityLevel: 'active',
  mealsPerDay: 2,
};
const cooperIdealDer = 70 * Math.pow(40 * 0.453592, 0.75) * 1.6;
check('ideal weight is the calorie target', calorieTargetWeightLbs(cooper), 40);
check('DER uses Cooper\'s 40 lb ideal weight', Math.abs(calcDER(cooper) - cooperIdealDer) < 0.001, true);
check(
  'serving grams use the ideal-weight DER',
  calcServing(cooper).totalDailyGrams,
  Math.round(cooperIdealDer / 1.1)
);
check(
  'missing ideal weight falls back to current weight',
  calorieTargetWeightLbs({ weightLbs: 45 }),
  45
);
check(
  'invalid ideal weight falls back to current weight',
  calorieTargetWeightLbs({ weightLbs: 45, idealWeightLbs: 0 }),
  45
);

// ── 7. The call sites stay fixed ──────────────────────────────────────────────
const detail = readFileSync('src/pages/Recipes/RecipeDetail.tsx', 'utf8');
if (/amountCups:\s*ingredient\.amountCups\s*\*\s*scaleFactor/.test(detail)) {
  failures.push('RecipeDetail is scaling the pre-rounded amountCups again.');
}
if (/totalYieldGrams\s*\/\s*240/.test(detail)) {
  failures.push('RecipeDetail is back to a flat 240 g/cup for the batch yield.');
}

if (failures.length) {
  console.error(`Portion scaling verification FAILED (${failures.length}):\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}

console.log('Portion scaling verified: continuous weight rounding, density-aware volumes, batch scaling re-derived from grams.');
