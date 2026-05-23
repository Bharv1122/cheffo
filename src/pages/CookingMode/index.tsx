import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Mic, MicOff, Volume2, VolumeX, Timer, X, ShoppingCart, Info } from 'lucide-react';
import { useRecipes } from '../../hooks/useRecipes';
import { useVoice } from '../../hooks/useVoice';
import { useUnitPreference } from '../../contexts/UnitPreferenceContext';
import { formatIngredientByPreference } from '../../utils/calculator';
import { getRecipePhoto } from '../../utils/recipeInsights';
import type { VoiceCommand } from '../../hooks/useVoice';

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setSeconds(s => {
      if (s <= 1) { setRunning(false); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const start = (secs: number) => { setSeconds(secs); setRunning(true); };
  const stop = () => { setRunning(false); setSeconds(0); };
  const format = () => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return { seconds, running, start, stop, format };
}

export default function CookingModePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getRecipe } = useRecipes();
  const { unitPreference } = useUnitPreference();
  const recipe = getRecipe(id!);

  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [muted, setMuted] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const timer = useTimer();

  // voiceRef breaks the circular dep between handleCommand and useVoice — handleCommand
  // is passed into useVoice, but its REPEAT_STEP / STOP_LISTENING branches need to call
  // back into voice. Reading through the ref keeps handleCommand stable across voice's
  // identity churn each render.
  const voiceRef = useRef<ReturnType<typeof useVoice> | null>(null);

  const handleCommand = useCallback((cmd: VoiceCommand) => {
    switch (cmd) {
      case 'NEXT_STEP': setCurrentStep(s => Math.min(s + 1, (recipe?.instructions.length ?? 1) - 1)); break;
      case 'PREV_STEP': setCurrentStep(s => Math.max(s - 1, 0)); break;
      case 'REPEAT_STEP': voiceRef.current?.speak(recipe?.instructions[currentStep]?.instruction ?? ''); break;
      case 'READ_INGREDIENTS': setShowIngredients(true); break;
      case 'SET_TIMER': timer.start(timerMinutes * 60); break;
      case 'STOP_LISTENING': voiceRef.current?.stopListening(); break;
    }
  }, [currentStep, recipe, timerMinutes, timer]);

  const voice = useVoice(handleCommand);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  // Auto-speak on step change. Intentionally only depends on currentStep — toggling
  // `muted` mid-step or `voice` identity churn must not retrigger the utterance.
  useEffect(() => {
    if (!muted && recipe) {
      const step = recipe.instructions[currentStep];
      if (step) voiceRef.current?.speak(`Step ${step.stepNumber}. ${step.instruction}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  if (!recipe) {
    return (
      <div className="min-h-screen bg-[#1C1917] flex items-center justify-center p-6 text-white">
        <div className="max-w-md rounded-3xl border border-[#3F3937] bg-[#262422] p-8 text-center">
          <div className="text-4xl">🍳</div>
          <h1 className="mt-2 text-2xl font-semibold">Recipe not found</h1>
          <p className="mt-2 text-sm text-[#A8A29E]">This recipe may have been deleted, or the link is from a different account.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => navigate('/recipes')}
              className="rounded-xl border border-[#3F3937] bg-[#1C1917] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2A2624]"
            >
              Back to Recipes
            </button>
            <button
              onClick={() => navigate('/bowl-builder')}
              className="rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a10]"
            >
              Create New Recipe
            </button>
          </div>
        </div>
      </div>
    );
  }

  const step = recipe.instructions[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === recipe.instructions.length - 1;
  const progress = ((currentStep + 1) / recipe.instructions.length) * 100;
  const recipePhoto = getRecipePhoto(recipe);

  return (
    <div className="min-h-screen bg-[#1C1917] flex flex-col text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4">
        <button onClick={() => navigate(`/recipes/${recipe.id}`)} className="flex items-center gap-2 text-sm text-[#A8A29E] hover:text-white transition-colors">
          <X size={18} /> Exit
        </button>
        <div className="text-sm text-[#A8A29E]">
          Step {currentStep + 1} of {recipe.instructions.length}
        </div>
        <button onClick={() => setShowIngredients(!showIngredients)} className="text-sm text-[#A8A29E] hover:text-white flex items-center gap-1 transition-colors">
          <ShoppingCart size={16} /> Ingredients
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[#422006]">
        <div className="h-full bg-[#F97316] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Ingredients panel */}
      {showIngredients && (
        <div className="bg-[#422006] p-4 mx-4 mt-4 rounded-2xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm">Ingredients</h3>
            <button onClick={() => setShowIngredients(false)} className="text-[#A8A29E] hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-1.5">
            {recipe.ingredients.map(ing => (
              <div key={ing.ingredientId} className="flex justify-between gap-3 text-sm">
                <span className="text-[#FDF6E9]">{ing.name}</span>
                <span className="text-right text-[#A8A29E]">{formatIngredientByPreference(ing, unitPreference)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main step display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center">
        <div className="mb-5 w-full max-w-md overflow-hidden rounded-2xl border border-[#574738] bg-[#2A2521]">
          <img
            src={recipePhoto.src}
            alt={recipePhoto.alt}
            className="h-44 w-full object-cover sm:h-52"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="w-16 h-16 rounded-full bg-[#F97316] flex items-center justify-center text-2xl font-bold mb-6">
          {step.stepNumber}
        </div>
        <p className="text-xl font-medium leading-relaxed max-w-md">{step.instruction}</p>

        {step.durationMinutes && (
          <div className="mt-4 inline-flex items-center gap-2 bg-[#422006] rounded-full px-4 py-2 text-sm text-[#F59E0B]">
            <Timer size={15} /> ~{step.durationMinutes} minutes
          </div>
        )}

        {step.tip && (
          <div className="mt-4 flex items-start gap-2 bg-[#422006]/60 rounded-xl p-3 text-sm text-left text-[#FDF6E9] max-w-sm">
            <Info size={14} className="shrink-0 mt-0.5 text-[#F59E0B]" />
            <span>{step.tip}</span>
          </div>
        )}
      </div>

      {/* Timer area */}
      {timer.running && (
        <div className="mx-4 mb-4 bg-[#422006] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#A8A29E]">Timer</p>
            <p className="text-3xl font-bold text-[#F59E0B] font-mono">{timer.format()}</p>
          </div>
          <button onClick={timer.stop} className="bg-[#1C1917] px-4 py-2 rounded-xl text-sm hover:bg-black transition-colors">Stop</button>
        </div>
      )}

      {/* Timer set (if not running) */}
      {!timer.running && (
        <div className="mx-4 mb-2 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Timer size={16} className="text-[#A8A29E]" />
            <input
              type="number"
              value={timerMinutes}
              min={1} max={120}
              onChange={e => setTimerMinutes(Number(e.target.value))}
              className="w-16 bg-[#422006] border border-[#78716C] rounded-lg px-2 py-1 text-sm text-center text-white focus:outline-none"
            />
            <span className="text-sm text-[#A8A29E]">min</span>
          </div>
          <button onClick={() => timer.start(timerMinutes * 60)} className="bg-[#422006] px-4 py-2 rounded-xl text-sm hover:bg-[#78716C]/30 transition-colors">
            Start Timer
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => setCurrentStep(s => Math.max(s - 1, 0))}
          disabled={isFirst}
          className="flex items-center justify-center gap-2 bg-[#422006] disabled:opacity-30 rounded-2xl py-4 text-base font-semibold transition-colors hover:bg-[#78716C]/30"
        >
          <ChevronLeft size={22} /> Previous
        </button>
        <button
          onClick={() => isLast ? navigate(`/recipes/${recipe.id}`) : setCurrentStep(s => s + 1)}
          className="flex items-center justify-center gap-2 bg-[#F97316] rounded-2xl py-4 text-base font-semibold hover:bg-[#EA6C0A] transition-colors"
        >
          {isLast ? 'Done!' : 'Next'} {!isLast && <ChevronRight size={22} />}
        </button>
      </div>

      {/* Voice controls */}
      <div className="px-4 pb-6 flex items-center justify-center gap-4">
        <button
          onClick={() => setMuted(m => !m)}
          className="flex items-center gap-2 text-sm text-[#A8A29E] hover:text-white transition-colors"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          {muted ? 'Read-aloud off' : 'Read-aloud on'}
        </button>

        {voice.supported.recognition ? (
          <button
            onClick={() => voice.listening ? voice.stopListening() : voice.startListening()}
            className={['flex items-center gap-2 text-sm transition-colors px-4 py-2 rounded-full border',
              voice.listening
                ? 'border-[#F97316] bg-[#F97316]/20 text-[#F97316] animate-pulse'
                : 'border-[#78716C] text-[#A8A29E] hover:text-white hover:border-white',
            ].join(' ')}
          >
            {voice.listening ? <Mic size={16} /> : <MicOff size={16} />}
            {voice.listening ? 'Listening…' : 'Voice Control'}
          </button>
        ) : (
          <span className="text-xs text-[#78716C]">Voice not supported in this browser</span>
        )}

        <button
          onClick={() => !muted && voice.speak(step.instruction)}
          className="flex items-center gap-1.5 text-sm text-[#A8A29E] hover:text-white transition-colors"
        >
          <Volume2 size={16} /> Re-read
        </button>
      </div>
    </div>
  );
}
