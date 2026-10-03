// WebXR kitchen for Meta Quest (and passthrough-capable headsets/glasses).
// Lazy-loaded from /kitchen/:id/xr so three.js never reaches the main bundle.
//
// Hands-only from start to finish: the 2D page's Start button is pressed with
// a pinch in the headset browser, every in-session control is a 3D button that
// answers a finger poke or a pinch-ray, and Exit ends the session. Voice is an
// optional extra where the browser has Web Speech (Quest Browser does not).
import { Component, Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { PointerEvents, XR, createXRStore, noEvents, useXR } from '@react-three/xr';
import type { Recipe } from '../types/recipe';
import { useUnitPreference } from '../contexts/UnitPreferenceContext';
import type { KitchenCommand } from '../kitchen/stepEngine';
import { useKitchenSession, useKitchenVoice } from '../kitchen/useKitchenSession';
import KitchenScene, { type KitchenSceneActions, type Posture } from './KitchenScene';

// Quest budget (as in HAL): 72 Hz when offered, fixed foveation for fill-rate.
// Hand tracking: poke (touch) and pinch-ray pointers are both on by default.
const store = createXRStore({
  offerSession: false,
  // Headset emulator for `npm run dev` on localhost only. Off in production
  // builds: it bundles a second copy of three.js for its devtools UI.
  emulate: import.meta.env.DEV ? { type: 'metaQuest3', primaryInputMode: 'hand', syntheticEnvironment: false } : false,
  frameRate: rates => (Array.from(rates).includes(72) ? 72 : false),
  foveation: 0.75,
  hand: { rayPointer: { rayModel: { color: '#f97316' } } },
  // Hand / controller models are served from this origin: the site CSP blocks
  // the library's default CDN (public/xr-input-profiles/README.md).
  baseAssetPath: `${location.origin}/xr-input-profiles/`,
  defaultControllerProfileId: 'meta-quest-touch-plus',
});

// Dev-only handle for the headless emulator test (tests/verify-kitchen-screens.cjs).
// `import.meta.env.DEV` is false in production builds, so this is compiled out.
type DevHandle = { store: typeof store; scene?: unknown; step?: number; timers?: number };
const devHandle = (): DevHandle | undefined => {
  if (!import.meta.env.DEV) return undefined;
  const w = window as unknown as { __kitchenXR?: DevHandle };
  return (w.__kitchenXR ??= { store });
};

function DevSceneHandle() {
  const scene = useThree(s => s.scene);
  useEffect(() => {
    const handle = devHandle();
    if (handle) handle.scene = scene;
  }, [scene]);
  return null;
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="flex h-full items-center justify-center p-6 text-center text-[#D6D3D1]">The 3D view couldn’t start on this device. The kitchen display works everywhere.</div>
      : this.props.children;
  }
}

function PreviewCamera() {
  const { camera, size } = useThree();
  const session = useXR(s => s.session);
  // Portrait screens pull back so both side panels stay in frame.
  useEffect(() => {
    if (session) return;
    const back = Math.max(1, Math.min(2.6, 1.3 * size.height / size.width));
    camera.position.set(0, 1.2, 0.25 + 0.55 * back);
    camera.lookAt(0, 1.18, -0.6);
  }, [camera, session, size.width, size.height]);
  return null;
}

type Support = { vr: boolean; ar: boolean; checked: boolean };
const getXR = () => (navigator as Navigator & { xr?: XRSystem }).xr;
function useXRSupport() {
  const [support, setSupport] = useState<Support>(() => ({ vr: false, ar: false, checked: !getXR() }));
  useEffect(() => {
    let live = true;
    const check = () => {
      const xr = getXR();
      if (!xr) return;
      Promise.all([
        xr.isSessionSupported('immersive-vr').catch(() => false),
        xr.isSessionSupported('immersive-ar').catch(() => false),
      ]).then(([vr, ar]) => { if (live) setSupport({ vr, ar, checked: true }); });
    };
    check();
    // Dev on localhost: the headset emulator installs itself asynchronously; keep looking for ~10 s.
    const retries = import.meta.env.DEV && location.hostname === 'localhost'
      ? [1000, 2500, 5000, 10000].map(ms => window.setTimeout(check, ms)) : [];
    return () => { live = false; retries.forEach(id => window.clearTimeout(id)); };
  }, []);
  return support;
}

export default function KitchenXR({ recipe, isSample, displayTo, exitTo }: { recipe: Recipe; isSample: boolean; displayTo: string; exitTo: string }) {
  const navigate = useNavigate();
  const { unitPreference } = useUnitPreference();
  const support = useXRSupport();
  const inSession = useSyncExternalStore(store.subscribe, () => !!store.getState().session);
  const session = useKitchenSession(recipe);
  const [posture, setPosture] = useState<Posture>('seated');
  const [recenterKey, setRecenterKey] = useState(0);
  const [startError, setStartError] = useState('');

  const handleCommand = useCallback((command: KitchenCommand) => {
    if (command === 'next') session.actions.next();
    else if (command === 'back') session.actions.back();
    else if (command === 'repeat') session.actions.repeat();
    else if (command === 'timer') session.startStepTimer();
  }, [session]);
  const voice = useKitchenVoice(handleCommand);
  const { speak } = voice;
  const { spoken } = session;
  // "Repeat" re-reads the step aloud when speech output exists.
  useEffect(() => {
    if (session.state.repeatCount) speak(spoken);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a repeat request
  }, [session.state.repeatCount]);

  useEffect(() => {
    const handle = devHandle();
    if (handle) {
      handle.step = session.state.step;
      handle.timers = session.state.timers.length;
    }
  }, [session.state.step, session.state.timers.length]);

  const endSession = useCallback(() => {
    const active = store.getState().session;
    if (active) void active.end().catch(() => {});
  }, []);

  const actions = useMemo<KitchenSceneActions>(() => ({
    next: session.actions.next,
    back: session.actions.back,
    repeat: session.actions.repeat,
    startStepTimer: () => { session.startStepTimer(); },
    addTimer: minutes => session.actions.addTimer(`${minutes} min`, minutes),
    pauseTimer: session.actions.pauseTimer,
    resumeTimer: session.actions.resumeTimer,
    cancelTimer: session.actions.cancelTimer,
    setPosture: next => { setPosture(next); setRecenterKey(k => k + 1); },
    recenter: () => setRecenterKey(k => k + 1),
    toggleVoice: () => (voice.status === 'listening' ? voice.stop() : voice.start()),
    exit: () => { if (store.getState().session) endSession(); else navigate(exitTo); },
  }), [session, voice, endSession, navigate, exitTo]);

  const enter = async (mode: 'ar' | 'vr') => {
    setStartError('');
    try {
      await (mode === 'ar' ? store.enterAR() : store.enterVR());
    } catch {
      setStartError('The headset didn’t start a session. Check the browser allows immersive mode, then try again.');
    }
  };

  const canEnter = support.ar || support.vr;
  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#1C1917] text-white" data-testid="kitchen-xr">
      <header className="flex flex-wrap items-center gap-3 px-4 pt-3 sm:px-6">
        <Link to={displayTo} className="flex min-h-12 items-center rounded-2xl px-3 text-base text-[#D6D3D1] hover:bg-[#2A2624]">← Kitchen display</Link>
        <h1 className="min-w-0 flex-1 truncate text-center text-lg font-semibold text-[#FDF6E9]">{recipe.name}</h1>
        <span className="rounded-full border border-[#F97316]/60 px-3 py-1 text-xs text-[#FDBA74]">Meta Quest · WebXR</span>
      </header>

      <section className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="relative h-[52vh] min-h-72 overflow-hidden rounded-3xl border border-[#3F3937] bg-[#14110f] lg:h-[70vh]">
          <Boundary>
            <Canvas events={noEvents} dpr={[1, 1.5]} camera={{ fov: 55, near: 0.02, far: 50 }} gl={{ antialias: true }}>
              <PointerEvents />
              <XR store={store}>
                <PreviewCamera />
                {import.meta.env.DEV && <DevSceneHandle />}
                <Suspense fallback={null}>
                  <KitchenScene
                    recipe={recipe}
                    isSample={isSample}
                    state={session.state}
                    now={session.now}
                    stepMinutes={session.stepMinutes}
                    unitPreference={unitPreference}
                    posture={posture}
                    recenterKey={recenterKey}
                    voice={voice.status}
                    voiceNote={voice.status === 'listening' || voice.status === 'error' ? voice.note : ''}
                    actions={actions}
                  />
                </Suspense>
              </XR>
            </Canvas>
          </Boundary>
        </div>

        <aside className="flex flex-col gap-4">
          {isSample && (
            <p className="rounded-2xl border border-[#F59E0B]/50 bg-[#422006] px-4 py-3 text-sm text-[#FDE68A]">
              Sample data: a real Cheffo Doggo recipe portioned for a fictional 30 lb adult dog. Nothing is saved.
            </p>
          )}
          <div className="rounded-3xl bg-[#262422] p-5">
            <div className="flex flex-col gap-3">
              {support.ar && (
                <button disabled={inSession} onClick={() => void enter('ar')} className="min-h-16 rounded-2xl bg-[#F97316] px-5 text-lg font-bold disabled:opacity-40">
                  {inSession ? 'In session' : 'Start in passthrough'}
                </button>
              )}
              {support.vr && (
                <button disabled={inSession} onClick={() => void enter('vr')} className={`min-h-16 rounded-2xl px-5 text-lg font-bold disabled:opacity-40 ${support.ar ? 'border border-[#57534E]' : 'bg-[#F97316]'}`}>
                  {inSession ? 'In session' : support.ar ? 'Start in VR instead' : 'Start in VR'}
                </button>
              )}
              <p className="text-sm text-[#A8A29E]" role="status">
                {!support.checked ? 'Checking for a headset…'
                  : canEnter ? 'Put your controllers down: pinch or poke the floating buttons with your hands.'
                  : 'Open this page in the Meta Quest Browser to cook in your headset. You can try the same controls here with a mouse.'}
              </p>
              {startError && <p className="text-sm text-[#FCA5A5]" role="alert">{startError}</p>}
            </div>
          </div>
          <div className="rounded-3xl bg-[#262422] p-5 text-sm text-[#D6D3D1]">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#F59E0B]">Hands only · no controllers</h2>
            <ol className="list-decimal space-y-1 pl-5">
              <li><strong>Pinch</strong> Start with your hand, then choose <strong>Seated</strong> or <strong>Standing</strong>.</li>
              <li><strong>Poke</strong> Next, Back or Repeat. Pinch-and-release works from further away.</li>
              <li><strong>Start a timer</strong> from the step (only when the recipe gives a time) or add +1/+5/+10 min.</li>
              <li>Press <strong>Recenter</strong> if the panels drift, and <strong>Exit</strong> when you’re done.</li>
            </ol>
            <p className="mt-3 text-[#A8A29E]">
              {voice.status === 'unsupported'
                ? 'Voice isn’t available in this browser; everything works by hand.'
                : 'Optional voice: say “next”, “back”, “repeat” or “start timer”.'}
            </p>
          </div>
          <p className="text-xs text-[#78716C]">Educational guidance, not veterinary advice. Check with your veterinarian before changing your dog’s diet.</p>
        </aside>
      </section>
    </main>
  );
}
