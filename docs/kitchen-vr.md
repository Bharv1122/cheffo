# Hands-free kitchen: display mode + WebXR

Two surfaces share one step engine (`src/kitchen/stepEngine.ts`, `src/kitchen/useKitchenSession.ts`):

| Route | Login | What it is |
| --- | --- | --- |
| `/kitchen/demo` | no | Kitchen display with the **sample recipe** |
| `/kitchen/demo/xr` | no | WebXR kitchen with the sample recipe (the judges' path) |
| `/kitchen/:recipeId` | yes | Kitchen display for a saved recipe (also linked from the recipe page: "Kitchen Display") |
| `/kitchen/:recipeId/xr` | yes | WebXR kitchen for a saved recipe |

**Sample data:** the demo is a real Cheffo Doggo recipe (the *Classic Chicken & Rice Bowl* template) portioned by the app's own generator for a fictional 30 lb adult dog. It's labelled "Sample" everywhere, runs in the browser and is never saved.

## Kitchen display (tablets, smart displays, phones)

- Big step text, ingredient amounts exactly as the recipe formats them, and 80 px Back / Repeat / Next targets.
- Landscape shows ingredients beside the step. Portrait has a Show/Hide ingredients toggle.
- Timers: "Start N-min timer" appears **only when the recipe step has a time**. The engine never invents a cooking time. Quick +1/+5/+10 min timers, up to 4 at once, with pause/resume/cancel. Timers use end timestamps, so a throttled background tab doesn't drift. A chime and vibration play when one finishes.
- Screen wake lock keeps the display on. If the browser refuses, the footer says "Screen may sleep" and nothing else changes.
- Arrow keys / space / R work for remotes and keyboards.
- Optional voice (Web Speech, where supported): "next", "back", "repeat", "ingredients", "start timer". Optional read-aloud.

## WebXR (Meta Quest, passthrough headsets / glasses)

- Offers **Start in passthrough** (`immersive-ar`) when supported, and VR otherwise.
- Floating step panel, ingredients panel, timers panel and a control dock. **Seated** (default: closer and lower) or **Standing** layout, plus **Recenter**.
- **Hands only, start to finish:** pinch the 2D Start button in the Quest Browser, then poke or pinch-ray every 3D control, and **Exit** ends the session. Buttons act on release after a press on the same button, so slow, deliberate pinches work. The library's `click` needs down→up under ~300 ms.
- Voice is optional and uses Web Speech only. Quest Browser has no Web Speech recognition, so **in-headset voice isn't available yet**. See follow-ups.
- Lazy-loaded: three.js / @react-three/* only load on the `/xr` route. `scripts/verify-xr-lazy.mjs` fails the build if XR code reaches the initial load.
- The site CSP blocks CDNs, so the hand/controller models are self-hosted in `public/xr-input-profiles/` (MIT, from `@webxr-input-profiles/assets`). Panel text is drawn to canvas textures, so no font download or blob worker is needed.

Patterns reused from HAL (`Hardware-Anatomy-Lab`, `claude/meta-contest-webxr-v2`, `src/xr/`): the XR store setup (72 Hz, foveation), `PointerEvents` + `noEvents`, rounded panels and press-in buttons from `ui3d.tsx`, `useRecenter`, the preview camera and the support check.

## What was verified, and how

| Check | Status |
| --- | --- |
| Display: tablet landscape/portrait + phone render, Next/Back/arrow key, timers, ≥72 px targets, no horizontal scroll, **real site CSP applied** | ✅ headless Chromium (`tests/verify-kitchen-screens.cjs`) |
| Saved-recipe route (localStorage mode) + step timer only when the step has a time | ✅ headless, test fixture |
| XR page renders its 3D preview (SwiftShader WebGL), CSP clean | ✅ headless |
| Enter passthrough → **pinch** Next, Next, Back, +5 min → pinch **Exit** ends session | ✅ **emulated** (IWER Meta Quest 3 emulator, hand mode, dev server). Not real hardware. |
| Finger **poke** on a real Quest, hand-tracking comfort, passthrough look, legibility at arm's length | ❌ **Unverified**: needs a headset |
| Meta VR glasses | ❌ **Unverified**: no device/emulator |

Run it yourself:

```bash
npm run build && npx vite preview --host localhost --port 4173 &
PLAYWRIGHT_MODULE_PATH=$(npm root -g)/playwright KITCHEN_BASE_URL=http://localhost:4173 \
  CHEFFO_TEST_OUTPUT_DIR=/tmp node tests/verify-kitchen-screens.cjs
# Emulated headset session (dev build only):
npx vite --host localhost --port 5199 &
PLAYWRIGHT_MODULE_PATH=$(npm root -g)/playwright KITCHEN_BASE_URL=http://localhost:5199 \
  CHEFFO_TEST_OUTPUT_DIR=/tmp node tests/verify-kitchen-screens.cjs
```

## Recording the demo video (< 3 minutes)

Meta's 2026 Start Developer Competition wants hands-only use from start to finish and favours seated use. Record on a Quest 3/3S with **controllers set down** (hand tracking on).

**Setup (off camera)**
1. Quest Browser → `https://cheffodoggo.com/kitchen/demo/xr` (or the preview-deploy URL). Bookmark it.
2. Settings → Movement tracking → Hand tracking **on**. Put the controllers out of reach.
3. Sit at a table or counter with real ingredients in view, so passthrough shows a real kitchen.
4. Recording: Quest menu → Camera → **Record video** (the mic records your narration). Or cast to a phone/PC and screen-record there for a steadier frame.

**Shot list (~2:30)**

| Time | Shot | Say / show |
| --- | --- | --- |
| 0:00–0:15 | Kitchen display on a tablet at `/kitchen/demo` | "Cheffo Doggo turns a homemade dog-food recipe into a hands-free kitchen." Tap Next once. |
| 0:15–0:30 | In headset: the 2D page, **pinch** "Start in passthrough" | "No controllers. I just pinch." |
| 0:30–0:45 | Panels appear over the real counter. Poke **Seated** | "Seated layout keeps everything within reach." |
| 0:45–1:30 | Poke **Next** through 2–3 steps. Look at the ingredients panel. Poke **Repeat** | Show the exact amounts and that the step text is readable. |
| 1:30–2:00 | On a step with a time, poke **Start N-min timer**. Poke **+1 min**. Pause and resume on the timers panel | "Timers come only from the recipe, never guessed." |
| 2:00–2:20 | Turn your head away, poke **Recenter** | Panels snap back in front. |
| 2:20–2:35 | Poke **Exit** | Back to the browser page. Hands-only start to finish. |
| 2:35–2:50 | Title card | "Sample data. Educational guidance, not veterinary advice." |

Tips: keep hands in view of the headset cameras, and poke with one extended index finger. If a poke misses, pinch-and-release at the button from further away (the ray also works). Record two takes and cut the best, and keep it under 3:00.

## Follow-ups (not in this PR)

- **On-device voice in the headset** (HAL's Vosk approach). It needs a ~29 MB model served from this origin and a CSP change (`'wasm-unsafe-eval'`, `worker-src blob:`) scoped to the XR route. That's left out on purpose: voice is optional.
- Test on real Quest hardware (poke accuracy, text size, seated reach), and on Meta VR glasses when available.
- The kitchen uses the saved recipe's amounts as stored. It doesn't carry over a custom batch size picked on the recipe page, same as the existing Cooking Mode.
