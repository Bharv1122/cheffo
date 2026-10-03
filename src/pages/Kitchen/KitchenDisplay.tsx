import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Glasses, ListChecks, Mic, MicOff, Pause, Play, RotateCcw, Sun, Timer, Volume2, VolumeX, X } from 'lucide-react';
import type { Recipe } from '../../types/recipe';
import { useUnitPreference } from '../../contexts/UnitPreferenceContext';
import { formatIngredientByPreference } from '../../utils/calculator';
import { formatClock, ingredientLine, timerRemainingMs, type KitchenCommand } from '../../kitchen/stepEngine';
import { useKitchenSession, useKitchenVoice, useScreenWakeLock } from '../../kitchen/useKitchenSession';

const QUICK_TIMERS = [1, 5, 10];

// Big-type, big-target cooking view for tablets and smart displays. Landscape
// puts ingredients beside the step; portrait stacks them under a toggle.
export default function KitchenDisplay({ recipe, isSample, exitTo, xrTo }: { recipe: Recipe; isSample: boolean; exitTo: string; xrTo: string }) {
  const navigate = useNavigate();
  const { unitPreference } = useUnitPreference();
  const session = useKitchenSession(recipe);
  const { state, step, actions, now } = session;
  const wakeLock = useScreenWakeLock();
  const [readAloud, setReadAloud] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [notice, setNotice] = useState('');

  const handleCommand = useCallback((command: KitchenCommand) => {
    switch (command) {
      case 'next': actions.next(); break;
      case 'back': actions.back(); break;
      case 'repeat': actions.repeat(); break;
      case 'ingredients': setShowIngredients(true); break;
      case 'timer':
        if (!session.startStepTimer()) setNotice('This step has no set time. Use a quick timer instead.');
        break;
      case 'help': setNotice('Say “next”, “back”, “repeat”, “ingredients” or “start timer”.'); break;
    }
  }, [actions, session]);
  const voice = useKitchenVoice(handleCommand);

  // Read the step aloud when it changes or on "repeat", if read-aloud is on.
  const { speak } = voice;
  const spokenRef = useRef(session.spoken);
  useEffect(() => { spokenRef.current = session.spoken; }, [session.spoken]);
  useEffect(() => {
    if (readAloud) speak(spokenRef.current);
  }, [readAloud, speak, state.step, state.repeatCount]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // Remote / keyboard control for smart displays: arrows, space, R.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); actions.next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); actions.back(); }
      else if (e.key.toLowerCase() === 'r') actions.repeat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);

  const total = recipe.instructions.length;
  const isFirst = state.step === 0;
  const isLast = state.step >= total - 1;
  const doneTimers = state.timers.filter(timer => timer.done);

  const ingredients = (
    <section aria-labelledby="kitchen-ingredients" className="rounded-3xl bg-[#262422] p-5 landscape:h-full landscape:overflow-y-auto">
      <h2 id="kitchen-ingredients" className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#F59E0B]">Ingredients</h2>
      <ul className="space-y-3">
        {recipe.ingredients.map(ing => (
          <li key={ing.ingredientId} className="border-b border-[#3F3937] pb-2 text-[clamp(1.1rem,2.2vw,1.6rem)] font-medium leading-snug text-[#FDF6E9] last:border-0">
            {ingredientLine(ing.name, formatIngredientByPreference(ing, unitPreference))}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#1C1917] text-white" data-testid="kitchen-display">
      <header className="flex items-center gap-3 px-4 pt-3 sm:px-6">
        <button onClick={() => navigate(exitTo)} className="flex min-h-12 items-center gap-2 rounded-2xl px-3 text-base text-[#D6D3D1] hover:bg-[#2A2624]" aria-label="Exit kitchen mode">
          <X size={22} /> Exit
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-[#FDF6E9] sm:text-lg">{recipe.name}</h1>
        <Link to={xrTo} className="flex min-h-12 items-center gap-2 rounded-2xl border border-[#3F3937] px-3 text-sm text-[#D6D3D1] hover:bg-[#2A2624]">
          <Glasses size={20} /> <span className="hidden sm:inline">VR / AR</span>
        </Link>
      </header>

      {isSample && (
        <p className="mx-4 mt-3 rounded-2xl border border-[#F59E0B]/50 bg-[#422006] px-4 py-2 text-center text-sm text-[#FDE68A] sm:mx-6">
          Sample data: portioned for a fictional 30 lb adult dog. <Link className="underline" to="/signup">Sign up</Link> to cook for your own dog.
        </p>
      )}

      <div className="mx-4 mt-3 flex items-center gap-3 sm:mx-6" aria-hidden="true">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#3F3937]">
          <div className="h-full bg-[#F97316] transition-all duration-300" style={{ width: `${((state.step + 1) / Math.max(1, total)) * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 landscape:grid landscape:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] landscape:items-stretch">
        <div className="hidden landscape:block">{ingredients}</div>

        <section aria-live="polite" aria-label="Current step" className="flex flex-col justify-center rounded-3xl bg-[#262422] p-6 sm:p-8">
          <p className="text-[clamp(1rem,2vw,1.4rem)] font-semibold uppercase tracking-[0.12em] text-[#F59E0B]">
            Step {state.step + 1} of {total}
          </p>
          <p className="mt-3 text-[clamp(1.6rem,4.2vw,3.4rem)] font-semibold leading-snug" data-testid="kitchen-step-text">
            {step?.instruction}
          </p>
          {step?.tip && <p className="mt-4 text-[clamp(1rem,2vw,1.35rem)] text-[#D6D3D1]">Tip: {step.tip}</p>}
          {session.stepMinutes && (
            <button onClick={session.startStepTimer} className="mt-6 flex min-h-16 w-fit items-center gap-3 rounded-2xl bg-[#422006] px-5 text-[clamp(1.1rem,2.2vw,1.5rem)] font-semibold text-[#FBBF24] hover:bg-[#57300a]">
              <Timer size={28} /> Start {session.stepMinutes}-min timer
            </button>
          )}
        </section>

        <div className="landscape:hidden">
          <button onClick={() => setShowIngredients(v => !v)} aria-expanded={showIngredients} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#3F3937] text-lg font-semibold text-[#FDF6E9]">
            <ListChecks size={22} /> {showIngredients ? 'Hide ingredients' : 'Show ingredients'}
          </button>
          {showIngredients && <div className="mt-3">{ingredients}</div>}
        </div>
      </div>

      {(state.timers.length > 0 || notice) && (
        <section aria-label="Timers" className="mx-4 flex flex-wrap gap-3 sm:mx-6">
          {state.timers.map(timer => {
            const remaining = timerRemainingMs(timer, now);
            const paused = timer.endsAt === null && !timer.done;
            return (
              <div key={timer.id} role={timer.done ? 'alert' : undefined} className={`flex items-center gap-3 rounded-2xl px-4 py-2 ${timer.done ? 'animate-pulse bg-[#F97316] text-white' : 'bg-[#422006]'}`}>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#FDE68A]">{timer.label}</p>
                  <p className="font-mono text-[clamp(1.6rem,3.5vw,2.6rem)] font-bold leading-none">{timer.done ? 'Done!' : formatClock(remaining)}</p>
                </div>
                {!timer.done && (
                  <button onClick={() => (paused ? actions.resumeTimer(timer.id) : actions.pauseTimer(timer.id))} className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1C1917]" aria-label={paused ? `Resume ${timer.label} timer` : `Pause ${timer.label} timer`}>
                    {paused ? <Play size={24} /> : <Pause size={24} />}
                  </button>
                )}
                <button onClick={() => actions.cancelTimer(timer.id)} className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1C1917]" aria-label={`${timer.done ? 'Dismiss' : 'Cancel'} ${timer.label} timer`}>
                  <X size={24} />
                </button>
              </div>
            );
          })}
          {doneTimers.length > 1 && <button onClick={actions.dismissDone} className="min-h-14 rounded-2xl border border-[#3F3937] px-4">Dismiss all done</button>}
          {notice && <p role="status" className="self-center text-base text-[#FDE68A]">{notice}</p>}
        </section>
      )}

      <nav aria-label="Step controls" className="grid grid-cols-[1fr_auto_1.4fr] gap-3 p-4 sm:p-6">
        <button onClick={actions.back} disabled={isFirst} className="flex min-h-20 items-center justify-center gap-2 rounded-3xl bg-[#3F3937] text-xl font-semibold disabled:opacity-30">
          <ChevronLeft size={30} /> Back
        </button>
        <button onClick={actions.repeat} className="flex min-h-20 min-w-20 flex-col items-center justify-center rounded-3xl border border-[#57534E] px-3 text-sm font-semibold" aria-label="Repeat step">
          <RotateCcw size={26} /> Repeat
        </button>
        <button onClick={() => (isLast ? navigate(exitTo) : actions.next())} className="flex min-h-20 items-center justify-center gap-2 rounded-3xl bg-[#F97316] text-xl font-bold hover:bg-[#EA6C0A]">
          {isLast ? 'Finish' : 'Next'} {!isLast && <ChevronRight size={30} />}
        </button>
      </nav>

      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 pb-4 text-sm text-[#A8A29E]">
        <span className="flex items-center gap-1"><Timer size={16} /> Quick timer:</span>
        {QUICK_TIMERS.map(minutes => (
          <button key={minutes} onClick={() => actions.addTimer(`${minutes} min`, minutes)} className="min-h-12 min-w-14 rounded-xl border border-[#3F3937] px-3 text-base text-white">+{minutes}m</button>
        ))}
        <button onClick={() => setReadAloud(v => !v)} aria-pressed={readAloud} disabled={!voice.supportedSpeech} className="flex min-h-12 items-center gap-2 rounded-xl border border-[#3F3937] px-3 disabled:opacity-40">
          {readAloud ? <Volume2 size={18} /> : <VolumeX size={18} />} Read aloud
        </button>
        {voice.status !== 'unsupported' ? (
          <button onClick={() => (voice.status === 'listening' ? voice.stop() : voice.start())} aria-pressed={voice.status === 'listening'} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 ${voice.status === 'listening' ? 'border-[#F97316] text-[#F97316]' : 'border-[#3F3937]'}`}>
            {voice.status === 'listening' ? <Mic size={18} /> : <MicOff size={18} />} {voice.status === 'listening' ? 'Listening' : 'Voice'}
          </button>
        ) : (
          <span>Voice isn’t available in this browser. Everything works by touch.</span>
        )}
        <span className="flex items-center gap-1" title="Keeps the screen on while you cook">
          <Sun size={16} /> {wakeLock === 'active' ? 'Screen stays on' : 'Screen may sleep'}
        </span>
      </footer>
      {voice.status === 'listening' || voice.status === 'error' ? (
        <p role="status" className="px-4 pb-3 text-center text-sm text-[#D6D3D1]">{voice.note}{voice.heard && voice.status === 'listening' ? ` · Heard “${voice.heard}”` : ''}</p>
      ) : null}
      <p className="px-4 pb-4 text-center text-xs text-[#78716C]">Educational guidance, not veterinary advice. Check with your veterinarian before changing your dog’s diet.</p>
    </main>
  );
}
