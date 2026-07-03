import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { calcRER, calcDER, calcServing, calcBatch, splitIngredients, gramsToOz } from '../../utils/calculator';
import { formatCalories, formatGrams, formatOz } from '../../utils/formatting';
import type { DogProfile, LifeStage, ActivityLevel } from '../../types/dog';

const LIFE_STAGE_OPTIONS = [
  { value: 'puppy', label: 'Puppy (under 1 year)' },
  { value: 'adult', label: 'Adult' },
  { value: 'senior', label: 'Senior (7+ years)' },
];
const ACTIVITY_OPTIONS = [
  { value: 'low', label: 'Low activity' },
  { value: 'moderate', label: 'Moderate activity' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very Active' },
];
const MEALS_OPTIONS = [1, 2, 3, 4].map(n => ({ value: String(n), label: `${n}x per day` }));

type MockDog = Pick<DogProfile, 'weightLbs' | 'lifeStage' | 'activityLevel' | 'mealsPerDay'>;

const DEFAULT_DOG: MockDog = {
  weightLbs: 30,
  lifeStage: 'adult',
  activityLevel: 'moderate',
  mealsPerDay: 2,
};

export default function CalculatorPage() {
  const { activeProfile } = useDogProfiles();
  // Derived state, no effect: until the user edits a field, the form tracks
  // the active dog's profile (which may hydrate async); after the first
  // edit, the user's values win.
  const [edited, setEdited] = useState<MockDog | null>(null);
  const prefill: MockDog | null = activeProfile
    ? {
        weightLbs: activeProfile.weightLbs,
        lifeStage: activeProfile.lifeStage,
        activityLevel: activeProfile.activityLevel,
        mealsPerDay: activeProfile.mealsPerDay,
      }
    : null;
  const dog = edited ?? prefill ?? DEFAULT_DOG;

  function set<K extends keyof MockDog>(key: K, val: MockDog[K]) {
    setEdited({ ...dog, [key]: val });
  }

  const isInvalidWeight = !Number.isFinite(dog.weightLbs) || dog.weightLbs <= 0;
  const weightError = isInvalidWeight ? 'Weight must be greater than 0 lbs.' : '';

  const rer = isInvalidWeight ? 0 : calcRER(dog.weightLbs);
  const der = isInvalidWeight ? 0 : calcDER(dog as DogProfile);
  const serving = isInvalidWeight
    ? { gramsPerMeal: 0, cupsPerMeal: 0, mealsPerDay: dog.mealsPerDay, totalDailyGrams: 0 }
    : calcServing(dog as DogProfile);
  const batch1 = calcBatch(serving, '1day');
  const batch3 = calcBatch(serving, '3day');
  const batch7 = calcBatch(serving, '7day');
  const split = splitIngredients(serving.totalDailyGrams);

  return (
    <>
      <Header title="Food Calculator" backTo="/" />
      <PageWrapper>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#1C1917]">Food Amount Calculator</h2>
          <p className="text-sm text-[#78716C] mt-1">Estimate daily portions, batch sizes, and ingredient amounts for your dog.</p>
        </div>

        <Disclaimer variant="warning" className="mb-4">
          All values below are <strong>estimates</strong> based on general formulas. Actual amounts depend on your specific recipe, your dog's health, and veterinary guidance. Always start with estimates and adjust based on your dog's condition and your vet's recommendations.
        </Disclaimer>

        {/* Input card */}
        <Card className="mb-4">
          <h3 className="font-semibold text-[#1C1917] text-sm mb-3">Your Dog's Details</h3>
          {!edited && activeProfile && (
            <p className="text-xs text-[#78716C] -mt-2 mb-3">Prefilled from {activeProfile.name}'s profile.</p>
          )}
          <div className="space-y-3">
            <Input
              label="Weight (lbs)"
              type="number"
              min={1} max={250}
              value={dog.weightLbs}
              onChange={e => {
                const parsed = Number(e.target.value);
                set('weightLbs', Number.isFinite(parsed) ? parsed : 0);
              }}
            />
            {weightError && (
              <p className="text-xs text-red-700">{weightError}</p>
            )}
            <Select
              label="Life Stage"
              value={dog.lifeStage}
              onChange={e => set('lifeStage', e.target.value as LifeStage)}
              options={LIFE_STAGE_OPTIONS}
            />
            <Select
              label="Activity Level"
              value={dog.activityLevel}
              onChange={e => set('activityLevel', e.target.value as ActivityLevel)}
              options={ACTIVITY_OPTIONS}
            />
            <Select
              label="Meals Per Day"
              value={String(dog.mealsPerDay)}
              onChange={e => set('mealsPerDay', Number(e.target.value))}
              options={MEALS_OPTIONS}
            />
          </div>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {/* Energy */}
          <Card>
            <h3 className="font-semibold text-[#1C1917] text-sm mb-3 flex items-center gap-2">
              <Calculator size={16} className="text-[#F97316]" /> Daily Energy Needs
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Resting (RER)', value: formatCalories(rer), hint: 'Base metabolic rate' },
                { label: 'Daily (DER)', value: formatCalories(der), hint: 'Adjusted for activity' },
              ].map(s => (
                <div key={s.label} className="bg-[#FDF6E9] rounded-xl p-3 text-center">
                  <p className="text-base font-bold text-[#1C1917]">{s.value}</p>
                  <p className="text-xs font-medium text-[#78716C]">{s.label}</p>
                  <p className="text-xs text-[#A8A29E]">{s.hint}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Per meal */}
          <Card>
            <h3 className="font-semibold text-[#1C1917] text-sm mb-3">Per Meal Amounts</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Per meal', value: formatGrams(serving.gramsPerMeal) },
                { label: 'Per meal (oz)', value: `${gramsToOz(serving.gramsPerMeal)} oz` },
                { label: 'Per meal (cups)', value: `${serving.cupsPerMeal}c` },
              ].map(s => (
                <div key={s.label} className="bg-[#FDF6E9] rounded-xl p-3">
                  <p className="text-sm font-bold text-[#1C1917]">{s.value}</p>
                  <p className="text-xs text-[#78716C]">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 text-center">
              <p className="text-xs text-[#78716C]">
                Daily total: <strong className="text-[#1C1917]">{formatGrams(serving.totalDailyGrams)}</strong> ({formatOz(serving.totalDailyGrams)})
              </p>
            </div>
          </Card>

          {/* Ingredient split */}
          <Card>
            <h3 className="font-semibold text-[#1C1917] text-sm mb-3">Estimated Daily Ingredient Split</h3>
            <div className="space-y-2">
              {[
                { label: '🥩 Protein (40%)', grams: split.proteinGrams },
                { label: '🌾 Carbs (30%)', grams: split.carbGrams },
                { label: '🥦 Vegetables (20%)', grams: split.vegGrams },
                { label: '🫒 Healthy Fat (10%)', grams: split.fatGrams },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-[#78716C]">{row.label}</span>
                  <span className="font-medium text-[#1C1917]">{formatGrams(row.grams)} ({formatOz(row.grams)})</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#A8A29E] mt-3 italic text-center">Proportions vary by recipe type. These are starting-point estimates.</p>
          </Card>

          {/* Batch sizes */}
          <Card>
            <h3 className="font-semibold text-[#1C1917] text-sm mb-3">Batch Sizes</h3>
            <div className="space-y-3">
              {[
                { label: '1-Day Batch', batch: batch1 },
                { label: '3-Day Batch', batch: batch3 },
                { label: '7-Day Batch', batch: batch7 },
              ].map(({ label, batch }) => (
                <div key={label} className="flex items-center justify-between border border-[#E7E5E4] rounded-xl p-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1C1917]">{label}</p>
                    <p className="text-xs text-[#78716C]">{batch.numberOfMeals} meals · {batch.numberOfContainers} containers</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#F97316]">{formatGrams(batch.totalYieldGrams)}</p>
                    <p className="text-xs text-[#78716C]">{formatOz(batch.totalYieldGrams)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </PageWrapper>
    </>
  );
}
