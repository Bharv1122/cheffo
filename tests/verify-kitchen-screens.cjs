// Headless check + screenshots of the kitchen display and the WebXR kitchen.
//
// Start the production build first: `npm run build && npx vite preview --host 127.0.0.1 --port 4173`.
// The site's real vercel.json headers (CSP, Permissions-Policy) are applied to
// every same-origin response, so CSP violations fail the run. Every external
// request is blocked. Chromium renders WebGL with SwiftShader (no GPU needed).
// Against the dev server (`npx vite --host localhost`), @react-three/xr's Meta
// Quest emulator (hand-tracking mode) stands in for a headset and the "Start in
// passthrough" flow is exercised too. Chromium's own device-less WebXR is
// disabled so the emulator can install. That is emulation, not a test on a
// physical Quest; production builds don't include the emulator.
//
// Env: PLAYWRIGHT_MODULE_PATH, CHROMIUM_PATH (default /opt/pw-browsers/chromium),
// KITCHEN_BASE_URL (default http://127.0.0.1:4173), CHEFFO_TEST_OUTPUT_DIR.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.KITCHEN_BASE_URL || 'http://127.0.0.1:4173';
const OUT = process.env.CHEFFO_TEST_OUTPUT_DIR || require('node:os').tmpdir();
const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../vercel.json'), 'utf8'));
const siteHeaders = Object.fromEntries(vercel.headers.find(rule => rule.source === '/(.*)').headers.map(h => [h.key, h.value]));

// A saved recipe for the localStorage (no-Supabase) mode. Clearly a fixture.
const fixture = {
  id: 'fixture-recipe', dogProfileId: 'fixture-dog', name: 'Test fixture: Turkey & Oats', description: 'Fixture', type: 'full_meal',
  ingredients: [
    { ingredientId: 'ground_turkey', name: 'Ground Turkey', category: 'protein', amountGrams: 454, groceryFriendlyAmount: '1 lb', displayMetric: '454 g', displayVolume: '1 lb' },
    { ingredientId: 'oats', name: 'Rolled Oats', category: 'carb', amountGrams: 80, groceryFriendlyAmount: '1 cup', displayMetric: '80 g', displayVolume: '1 cup' },
  ],
  instructions: [
    { stepNumber: 1, instruction: 'Brown the turkey in a dry pan, breaking it up.', durationMinutes: 8 },
    { stepNumber: 2, instruction: 'Cook the oats in water until soft.' },
  ],
  nutrition: { caloriesPerServing: 300, caloriesPerDay: 600, isEstimate: true },
  serving: { gramsPerMeal: 200, cupsPerMeal: 1, mealsPerDay: 2, totalDailyGrams: 400 },
  batch: { totalYieldGrams: 400, numberOfMeals: 2, numberOfContainers: 1, fridgeMeals: 2, freezerMeals: 0, usedFor: '1day' },
  supplements: [], storage: { fridgeDays: 3, freezerMonths: 2, thawInstructions: '', servingTemperature: '', portioningNotes: '' },
  shoppingList: [], safetyNotes: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

async function newPage(browser, viewport, log) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 900 });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (!url.startsWith(BASE)) return route.abort();
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), ...siteHeaders } });
  });
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const page = await context.newPage();
  page.on('pageerror', e => log.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') log.push(`console: ${m.text()}`); });
  return { context, page };
}

async function cspClean(page, name) {
  const violations = await page.evaluate(() => window.__csp);
  assert.deepEqual(violations, [], `${name}: CSP violations`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-blink-features=WebXR'],
  });
  const results = [];
  const log = [];
  try {
    // Kitchen display: tablet landscape + portrait, phone.
    for (const [name, viewport] of [['kitchen-tablet-landscape', { width: 1280, height: 800 }], ['kitchen-tablet-portrait', { width: 800, height: 1280 }], ['kitchen-phone', { width: 390, height: 844 }]]) {
      const { context, page } = await newPage(browser, viewport, log);
      await page.goto(`${BASE}/kitchen/demo`);
      await page.getByTestId('kitchen-step-text').waitFor();
      assert.match(await page.textContent('body'), /Sample data/);
      assert.equal(await page.getByText('Step 1 of', { exact: false }).count() > 0, true);
      await page.getByRole('button', { name: /^Next/ }).click();
      await page.getByText(/Step 2 of/).waitFor();
      await page.getByRole('button', { name: 'Back' }).click();
      await page.getByText(/Step 1 of/).waitFor();
      await page.keyboard.press('ArrowRight');
      await page.getByText(/Step 2 of/).waitFor();
      await page.getByRole('button', { name: '+5m' }).click();
      await page.getByText('5 min').first().waitFor();
      if (viewport.width < viewport.height) {
        await page.getByRole('button', { name: /Show ingredients/ }).click();
      }
      const targets = await page.$$eval('nav[aria-label="Step controls"] button', els => els.map(el => el.getBoundingClientRect().height));
      assert.ok(targets.every(h => h >= 72), `${name}: step buttons must be at least 72px tall (${targets})`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${name}: no horizontal scroll (${overflow}px)`);
      await cspClean(page, name);
      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
      results.push(name);
      await context.close();
    }

    // Saved recipe path in localStorage mode (no Supabase env in this build).
    {
      const { context, page } = await newPage(browser, { width: 1280, height: 800 }, log);
      await context.addInitScript(r => localStorage.setItem('chef-doggo:recipes', JSON.stringify([r])), fixture);
      await page.goto(`${BASE}/kitchen/${fixture.id}`);
      await page.getByText('Brown the turkey', { exact: false }).waitFor();
      await page.getByRole('button', { name: /Start 8-min timer/ }).click();
      await page.getByText('Step 1', { exact: true }).waitFor();
      await page.getByRole('button', { name: /^Next/ }).click();
      assert.equal(await page.getByRole('button', { name: /min timer/ }).count(), 0, 'a step without a duration offers no step timer');
      await cspClean(page, 'kitchen-saved');
      await page.screenshot({ path: path.join(OUT, 'kitchen-saved-fixture.png') });
      results.push('kitchen-saved-fixture');
      await context.close();
    }

    // WebXR page: 2D preview, then enter emulated passthrough and press 3D buttons.
    for (const [name, viewport] of [['xr-desktop', { width: 1280, height: 800 }], ['xr-phone', { width: 390, height: 844 }]]) {
      const { context, page } = await newPage(browser, viewport, log);
      await page.goto(`${BASE}/kitchen/demo/xr`);
      await page.getByTestId('kitchen-xr').waitFor();
      await page.waitForSelector('canvas');
      await page.waitForTimeout(BASE.includes('localhost') ? 6000 : 2500);
      const canvasSize = await page.$eval('canvas', c => [c.width, c.height]);
      assert.ok(canvasSize[0] > 100 && canvasSize[1] > 100, 'canvas renders');
      await cspClean(page, name);
      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
      results.push(name);
      if (name === 'xr-desktop') {
        const start = page.getByRole('button', { name: 'Start in passthrough' });
        if (await start.count()) {
          await start.click();
          await page.getByRole('button', { name: 'In session' }).first().waitFor({ timeout: 15000 });
          await page.waitForTimeout(2500);
          await cspClean(page, 'xr-session');
          // Hands only: aim the emulated right hand's ray at a 3D button and
          // pinch. Held for 600 ms on purpose, i.e. a slow, deliberate pinch.
          const pinch = async name => {
            await page.evaluate(target => {
              const handle = window.__kitchenXR;
              const object = handle.scene.getObjectByName(target);
              const V = object.position.constructor;
              const Q = object.quaternion.constructor;
              const at = object.getWorldPosition(new V());
              const from = new V(at.x, at.y + 0.12, at.z + 0.22);
              const aim = new Q().setFromUnitVectors(new V(0, 0, -1), at.clone().sub(from).normalize());
              // The emulator UI re-syncs hand poses from its transform handles every frame.
              const hand = window.transformHandles.get('right');
              hand.parent.updateWorldMatrix(true, false);
              const local = hand.parent.worldToLocal(from.clone());
              hand.position.set(local.x, local.y, local.z);
              hand.quaternion.copy(hand.parent.getWorldQuaternion(new Q()).invert().multiply(aim));
            }, name);
            await page.waitForTimeout(500);
            await page.evaluate(() => window.__kitchenXR.store.getState().emulator.hands.right.updatePinchValue(1));
            await page.waitForTimeout(600);
            await page.evaluate(() => window.__kitchenXR.store.getState().emulator.hands.right.updatePinchValue(0));
            await page.waitForTimeout(600);
            return page.evaluate(() => ({ step: window.__kitchenXR.step, timers: window.__kitchenXR.timers }));
          };
          assert.equal((await pinch('xr-next')).step, 1, 'pinch Next advances');
          assert.equal((await pinch('xr-next')).step, 2, 'pinch Next again');
          assert.equal((await pinch('xr-back')).step, 1, 'pinch Back goes back');
          assert.equal((await pinch('xr-plus5')).timers, 1, 'pinch +5 min starts a timer');
          await page.screenshot({ path: path.join(OUT, 'xr-emulated-session.png') });
          await pinch('xr-exit');
          await page.getByRole('button', { name: 'Start in passthrough' }).waitFor({ timeout: 10000 });
          results.push('xr-emulated-session: enter passthrough, pinch Next/Next/Back/+5 min/Exit (IWER emulator, not hardware)');
        } else {
          log.push('note: no immersive-ar offered (production build or no emulator); session step skipped');
        }
      }
      await context.close();
    }

    const errors = log.filter(line => !line.startsWith('note:') && !/Download the React DevTools|WebGL|GPU stall|GroupMarkerNotSet/i.test(line));
    fs.writeFileSync(path.join(OUT, 'kitchen-screens-evidence.json'), JSON.stringify({ results, log }, null, 2));
    assert.deepEqual(errors, [], 'no page errors');
    console.log(`Kitchen screens verified: ${results.join(', ')}. Screenshots in ${OUT}.`);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
