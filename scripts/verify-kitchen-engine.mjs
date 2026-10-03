// The kitchen display and the WebXR kitchen share one step engine. Verify its
// navigation bounds, timer maths (end-timestamp based, pause/resume, done),
// the never-invent-a-time rule and the voice command parser.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
registerHooks({resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const candidate = resolve(dirname(fileURLToPath(context.parentURL)), `${specifier.replace(/\.js$/, '')}.ts`);
    if (existsSync(candidate)) return {url: pathToFileURL(candidate).href, shortCircuit: true};
  }
  return nextResolve(specifier, context);
}});
const E = await import('../src/kitchen/stepEngine.ts');
const {kitchenReducer: reduce, initialKitchenState} = E;
const run = (state, ...actions) => actions.reduce(reduce, state);

// Navigation stays inside the recipe.
let s = initialKitchenState(3);
assert.equal(run(s, {type: 'back'}).step, 0);
assert.equal(run(s, {type: 'next'}, {type: 'next'}, {type: 'next'}, {type: 'next'}).step, 2);
assert.equal(run(s, {type: 'goto', step: 99}).step, 2);
assert.equal(run(s, {type: 'goto', step: -4}).step, 0);
assert.equal(run(s, {type: 'goto', step: Number.NaN}).step, 0);
assert.equal(run(s, {type: 'repeat'}, {type: 'repeat'}).repeatCount, 2);
// A recipe that loads after the first render updates the bounds.
s = run(initialKitchenState(0), {type: 'next'});
assert.equal(s.step, 0);
s = run(s, {type: 'setTotal', total: 5}, {type: 'next'}, {type: 'next'});
assert.equal(s.step, 2);
assert.equal(run(s, {type: 'setTotal', total: 2}).step, 1, 'shrinking the recipe clamps the step');

// Timers are driven by end timestamps: a throttled tab can't drift them.
const t0 = 1_000_000;
s = run(initialKitchenState(4), {type: 'addTimer', label: 'Step 2', minutes: 10, stepNumber: 2, now: t0});
const [timer] = s.timers;
assert.equal(timer.durationMs, 600_000);
assert.equal(E.timerRemainingMs(timer, t0 + 61_000), 539_000);
assert.equal(E.timerRemainingMs(timer, t0 - 5_000), 600_000, 'a lagging clock never shows more than the duration');
s = run(s, {type: 'pauseTimer', id: timer.id, now: t0 + 60_000});
assert.equal(E.timerRemainingMs(s.timers[0], t0 + 999_999), 540_000, 'paused timers hold');
s = run(s, {type: 'tick', now: t0 + 10_000_000});
assert.equal(s.timers[0].done, false, 'paused timers never finish');
s = run(s, {type: 'resumeTimer', id: timer.id, now: t0 + 100_000});
s = run(s, {type: 'tick', now: t0 + 100_000 + 539_999});
assert.equal(s.timers[0].done, false);
s = run(s, {type: 'tick', now: t0 + 100_000 + 540_000});
assert.equal(s.timers[0].done, true);
assert.equal(E.formatClock(E.timerRemainingMs(s.timers[0], t0)), '0:00');
s = run(s, {type: 'dismissDone'});
assert.equal(s.timers.length, 0);
for (const minutes of [0, -1, Number.NaN, E.MAX_TIMER_MINUTES + 1]) {
  assert.equal(run(initialKitchenState(1), {type: 'addTimer', label: 'x', minutes, now: t0}).timers.length, 0, `rejects ${minutes} min`);
}
s = initialKitchenState(1);
for (let i = 0; i < 6; i++) s = run(s, {type: 'addTimer', label: `t${i}`, minutes: 1, now: t0});
assert.equal(s.timers.length, E.MAX_TIMERS, 'running timers are capped');
assert.deepEqual(new Set(s.timers.map(t => t.id)).size, E.MAX_TIMERS, 'timer ids are unique');
assert.equal(run(s, {type: 'cancelTimer', id: s.timers[1].id}).timers.length, E.MAX_TIMERS - 1);
assert.equal(E.formatClock(65_000), '1:05');
assert.equal(E.formatClock(3_725_000), '1:02:05');
assert.equal(E.formatClock(1), '0:01', 'rounds up so "0:00" only shows when done');

// Step timers only come from the recipe; nothing is invented.
assert.equal(E.stepTimerMinutes({stepNumber: 1, instruction: 'Simmer', durationMinutes: 12}), 12);
assert.equal(E.stepTimerMinutes({stepNumber: 1, instruction: 'Simmer until done'}), null);
assert.equal(E.stepTimerMinutes({stepNumber: 1, instruction: 'x', durationMinutes: 0}), null);
assert.equal(E.stepTimerMinutes(undefined), null);

// Ingredient lines never alter the formatted amount.
assert.equal(E.ingredientLine('Chicken Breast', '1 ¼ cups Chicken Breast (6 oz)'), '1 ¼ cups Chicken Breast (6 oz)');
assert.equal(E.ingredientLine('Fish Oil', '¼ tsp'), 'Fish Oil: ¼ tsp');

// Voice / typed commands.
const cases = {
  'next': 'next', 'next step please': 'next', 'okay continue': 'next', "I'm done": 'next',
  'go back': 'back', 'previous': 'back', 'back': 'back',
  'repeat that': 'repeat', 'say that again': 'repeat',
  'start timer': 'timer', 'set a timer': 'timer',
  'read the ingredients': 'ingredients', 'what do I need': 'ingredients',
  'help': 'help', 'banana': null, 'nextdoor': null,
};
for (const [text, expected] of Object.entries(cases)) assert.equal(E.parseKitchenCommand(text), expected, `"${text}"`);

// Both surfaces must use this engine, and the XR code must stay lazy.
const {readFileSync} = await import('node:fs');
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
for (const file of ['src/pages/Kitchen/KitchenDisplay.tsx', 'src/xr/KitchenXR.tsx']) {
  assert.match(read(file), /useKitchenSession\(recipe\)/, `${file} must use the shared engine`);
}
assert.match(read('src/pages/Kitchen/index.tsx'), /lazy\(\(\) => import\('..\/..\/xr\/KitchenXR'\)\)/, 'XR must be lazy-loaded');
assert.doesNotMatch(read('src/App.tsx'), /from '.\/xr\/|@react-three|from 'three'/, 'App must not import XR code eagerly');

console.log('Kitchen step engine verified: navigation, timers, no invented times, commands, shared by both surfaces.');
