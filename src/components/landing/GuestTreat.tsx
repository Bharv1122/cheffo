import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChefHat, Leaf, Lock, ShieldAlert, Sparkles } from 'lucide-react';
import type { LifeStage } from '../../types/dog';
import type { Recipe } from '../../types/recipe';
import {
  COMMON_TREAT_ADDITIVES,
  generateGuestTreat,
  stashGuestDogForSignup,
} from '../../utils/guestTreat';
import { trackFunnelEvent } from '../../lib/funnelAnalytics';

const LIFE_STAGES: Array<{ value: LifeStage; label: string }> = [
  { value: 'puppy', label: 'Puppy (under 1)' },
  { value: 'adult', label: 'Adult (1–7)' },
  { value: 'senior', label: 'Senior (7+)' },
];

/**
 * The logged-out funnel: a personalized treat preview with no account.
 *
 * Everything here runs in the browser — Cheffo generates treat text from vetted
 * templates client-side, so this costs nothing per visitor and has no abuse
 * surface. The visitor sees enough to believe it (their dog's name, their dog's
 * safe daily amount, the real recipe title, zero additives) and signs up for the
 * part that takes work (amounts, method, supplements, shopping list).
 */
export function GuestTreat() {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [lifeStage, setLifeStage] = useState<LifeStage>('adult');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  const weightNum = Number(weight);
  const weightValid = Number.isFinite(weightNum) && weightNum >= 2 && weightNum <= 250;
  const dogLabel = name.trim() || 'your dog';

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (!weightValid) {
      setError('Enter a weight between 2 and 250 lbs.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const generated = await generateGuestTreat({
        name: name.trim(),
        weightLbs: weightNum,
        lifeStage,
      });
      setRecipe(generated);
      void trackFunnelEvent('preview_started');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build a treat. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleUnlock() {
    stashGuestDogForSignup({ name: name.trim(), weightLbs: weightNum, lifeStage });
  }

  if (recipe) {
    const visibleStep = recipe.instructions[0];
    const hiddenStepCount = Math.max(0, recipe.instructions.length - 1);

    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-[#eadfce] bg-white p-5 text-left shadow-xl sm:p-7">
        {/* Before / after: what the bag has vs. what this recipe has */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <div className="rounded-2xl bg-[#fdf1f1] p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#c0392b]">
              <ShieldAlert size={14} aria-hidden="true" />
              A typical store-bought treat
            </p>
            <p className="mt-1 text-2xl font-bold text-[#c0392b]">
              {COMMON_TREAT_ADDITIVES.length} common additives
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMMON_TREAT_ADDITIVES.map(additive => (
                <span
                  key={additive}
                  className="rounded-full bg-[#f8dcd8] px-2 py-0.5 text-xs font-medium text-[#a5342a]"
                >
                  {additive}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center py-1 sm:px-2">
            <span className="rounded-full bg-[#ffe8cf] p-2">
              <ArrowRight size={18} className="rotate-90 text-[#f97316] sm:rotate-0" aria-hidden="true" />
            </span>
          </div>
          <div className="rounded-2xl bg-[#eaf6ea] p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#2f8e56]">
              <Leaf size={14} aria-hidden="true" />
              {dogLabel}&rsquo;s treat
            </p>
            <p className="mt-1 text-2xl font-bold text-[#2f8e56]">0 additives</p>
            <p className="mt-2 text-sm text-[#5f564d]">
              {recipe.ingredients.length} real{' '}
              {recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'} from the grocery store.
            </p>
          </div>
        </div>

        {/* The recipe itself */}
        <h3 className="mt-5 text-2xl font-bold text-[#2b2118]">{recipe.name}</h3>
        <ul className="mt-3 space-y-1">
          {recipe.ingredients.map(ingredient => (
            <li key={ingredient.ingredientId} className="flex items-start gap-2 text-[#3a302a]">
              <span className="mt-1 text-[#f97316]" aria-hidden="true">
                •
              </span>
              <span>{ingredient.name}</span>
            </li>
          ))}
        </ul>

        {/* Gate the part that takes real work: amounts, method, portioning.
            We blur ACTUAL withheld content — never invented filler rows. */}
        <div className="mt-4 rounded-2xl border border-[#eadfce] bg-[#fffaf3] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9c8568]">How to make it</p>
          <p className="mt-2 text-sm text-[#3a302a]">
            <span className="font-semibold">1.</span> {visibleStep?.instruction}
          </p>
          {hiddenStepCount > 0 && (
            <p className="mt-1 select-none text-sm text-[#3a302a] blur-[3px]" aria-hidden="true">
              {recipe.instructions[1]?.instruction}
            </p>
          )}
          <p className="mt-3 text-xs text-[#9c8568]">
            {hiddenStepCount > 0 && `+${hiddenStepCount} more steps, `}exact amounts, and{' '}
            {dogLabel}&rsquo;s safe daily treat limit unlock with a free account.
          </p>
        </div>

        <div className="mt-4 rounded-2xl border-2 border-[#f4ddc1] bg-[#fff6ec] p-5 text-center">
          <Lock size={24} className="mx-auto text-[#f97316]" aria-hidden="true" />
          <p className="mt-2 font-semibold text-[#2b2118]">
            Create a free account to get the full recipe
          </p>
          <p className="mt-1 text-sm text-[#7e6b54]">
            Portions scaled to {dogLabel}&rsquo;s {weightNum} lbs, step-by-step method, and a shopping
            list. No card needed.
          </p>
          <Link
            to="/signup?src=guest-treat"
            onClick={handleUnlock}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3 font-semibold text-white shadow-sm hover:bg-[#ea6a0c]"
          >
            <Sparkles size={16} aria-hidden="true" />
            Unlock {dogLabel}&rsquo;s recipe — free
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setRecipe(null)}
          className="mt-3 w-full text-sm text-[#9c9288] hover:text-[#5f564d]"
        >
          ← Try a different dog
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleGenerate}
      className="mx-auto max-w-2xl rounded-3xl border border-[#eadfce] bg-white p-5 text-left shadow-xl sm:p-7"
    >
      <h2 className="text-center text-xl font-bold text-[#2b2118]">
        Preview a personalized treat idea — free, no signup
      </h2>
      <p className="mt-1 text-center text-sm text-[#7f7469]">
        See the recipe title and ingredients now. A free account unlocks exact amounts, portions, and every step.
      </p>

      {/* Side by side even on phones — stacking these pushed the submit button
          below the fold on a 375x812 screen. */}
      <div className="mt-4 grid grid-cols-[1.2fr_0.8fr] gap-3">
        <label className="block">
          <span className="text-sm font-medium text-[#3a302a]">
            Dog&rsquo;s name <span className="font-normal text-[#9c9288]">(optional)</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Rosco"
            maxLength={30}
            className="mt-1 w-full rounded-xl border border-[#eadfce] bg-white px-3 py-2.5 text-[#2b2118] placeholder:text-[#c4bcb2] focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-[#3a302a]">Weight (lbs)</span>
          <input
            type="number"
            inputMode="numeric"
            value={weight}
            onChange={event => setWeight(event.target.value)}
            placeholder="45"
            min={2}
            max={250}
            required
            className="mt-1 w-full rounded-xl border border-[#eadfce] bg-white px-3 py-2.5 text-[#2b2118] placeholder:text-[#c4bcb2] focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
          />
        </label>
      </div>

      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-[#3a302a]">Life stage</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {LIFE_STAGES.map(stage => (
            <button
              key={stage.value}
              type="button"
              onClick={() => setLifeStage(stage.value)}
              aria-pressed={lifeStage === stage.value}
              className={
                lifeStage === stage.value
                  ? 'rounded-xl border-2 border-[#f97316] bg-[#fff6ec] px-2 py-2 text-sm font-semibold text-[#2b2118]'
                  : 'rounded-xl border border-[#eadfce] bg-white px-2 py-2 text-sm text-[#5f564d] hover:bg-[#fff6ec]'
              }
            >
              {stage.label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !weightValid}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-[#ea6a0c] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          'Building the recipe…'
        ) : (
          <>
            <ChefHat size={18} aria-hidden="true" />
            Preview {dogLabel}&rsquo;s treat
          </>
        )}
      </button>
      <p className="mt-2 text-center text-xs text-[#9c9288]">
        No account, no card. Your dog&rsquo;s details stay in this browser.
      </p>
    </form>
  );
}
