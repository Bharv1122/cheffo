import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, ArrowRight, ArrowLeft } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StepProgress } from '../../components/ui/ProgressBar';
import { DogProfileForm } from '../../components/dog/DogProfileForm';
import { RecipeTypeSelector } from '../../components/recipe/RecipeTypeSelector';
import { Logo } from '../../components/layout/Logo';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { useRecipes } from '../../hooks/useRecipes';
import { generateRecipe } from '../../utils/recipeGenerator';
import type { RecipeType } from '../../types/recipe';
import type { DogProfile } from '../../types/dog';

const STEPS = ['Welcome', 'Your Dog', 'Recipe Type', 'Generate'];
const STEP_LABELS = ['Welcome', 'Your Dog', 'Recipe Type', 'Your Recipe'];

type WizardDog = Omit<DogProfile, 'id' | 'createdAt' | 'updatedAt'>;

export default function WizardPage() {
  const navigate = useNavigate();
  const { createProfile, activeProfile, profiles } = useDogProfiles();
  const { saveRecipe, recipes } = useRecipes();

  const [step, setStep] = useState(0);
  const [dog, setDog] = useState<WizardDog | null>(null);
  const [recipeType, setRecipeType] = useState<RecipeType>('full_meal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If they already have profiles, start at step 1 (skip dog creation)
  const hasProfiles = profiles.length > 0;
  // Gate "first recipe" copy on whether they actually have any. (CHE-117)
  const hasRecipes = recipes.length > 0;
  const effectiveDog = dog ?? (activeProfile ? { ...activeProfile } : null);

  function next() { setStep(s => s + 1); }
  function prev() { setStep(s => Math.max(0, s - 1)); }

  async function handleGenerate() {
    const targetDog = effectiveDog;
    if (!targetDog) { setError('Please complete your dog profile first.'); return; }

    setLoading(true);
    setError('');

    // Save profile if newly created
    let dogProfile: DogProfile;
    if (dog && !profiles.find(p => p.name === dog.name && p.breed === dog.breed)) {
      dogProfile = await createProfile(dog);
    } else {
      dogProfile = activeProfile!;
    }

    try {
      const recipe = await generateRecipe({
        dog: dogProfile,
        recipeType,
        batchDuration: recipeType === 'batch_week' ? '7day' : '1day',
      });
      const saved = await saveRecipe(recipe);
      navigate(`/recipes/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate recipe. Please try again.');
      setLoading(false);
    }
  }

  return (
    <>
      <Header title={hasRecipes ? 'Recipe Wizard' : 'First Bowl Wizard'} backTo="/" />
      <PageWrapper>
        <div className="mb-6">
          <StepProgress currentStep={step} totalSteps={STEPS.length} stepLabels={STEP_LABELS} />
        </div>

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center gap-6">
            <Logo size="xl" showText={false} />
            <div>
              <h2 className="text-2xl font-bold text-[#1C1917]">
                {hasRecipes ? 'Welcome back! 🐾' : 'Welcome to Cheffo Doggo! 🐾'}
              </h2>
              <p className="text-[#78716C] mt-2 leading-relaxed">
                {hasRecipes
                  ? 'Let\'s build a new homemade dog food recipe. This wizard takes about 2 minutes and creates a safe, personalized recipe for your dog.'
                  : 'Let\'s build your first homemade dog food recipe. This wizard takes about 2 minutes and creates a safe, personalized recipe for your dog.'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 w-full text-left">
              {[
                '✅ Portion sizes calculated for your dog',
                '✅ Safety-checked ingredients',
                '✅ Shopping list included',
                '✅ Storage instructions',
                '🐾 Built with love by Cheffo Doggo',
              ].map(item => (
                <div key={item} className="bg-[#FDF6E9] rounded-xl p-3 text-sm text-[#1C1917]">{item}</div>
              ))}
            </div>
            <Button fullWidth size="lg" icon={<ArrowRight size={18} />} onClick={next}>
              {hasProfiles ? 'Build a New Recipe' : 'Let\'s Get Started'}
            </Button>
          </div>
        )}

        {/* Step 1 — Dog Profile */}
        {step === 1 && (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-[#1C1917]">Tell me about your dog</h2>
              <p className="text-sm text-[#78716C] mt-1">I'll use this to calculate the right portions and pick appropriate ingredients.</p>
            </div>

            {hasProfiles && (
              <Card className="mb-4">
                <p className="text-sm text-[#1C1917] font-medium mb-2">Use existing profile:</p>
                <div className="space-y-2">
                  {profiles.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setDog(null); next(); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#E7E5E4] hover:border-[#F97316] hover:bg-orange-50 transition-colors text-left"
                    >
                      <span className="text-2xl">🐶</span>
                      <div>
                        <p className="font-medium text-[#1C1917] text-sm">{p.name}</p>
                        <p className="text-xs text-[#78716C]">{p.breed} · {p.weightLbs} lbs</p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-center text-[#A8A29E] mt-3">— or create a new profile below —</p>
              </Card>
            )}

            <DogProfileForm
              onSave={data => { setDog(data); next(); }}
              onCancel={step > 0 ? prev : undefined}
            />
          </div>
        )}

        {/* Step 2 — Recipe type */}
        {step === 2 && (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-bold text-[#1C1917]">What kind of recipe?</h2>
              <p className="text-sm text-[#78716C] mt-1">Choose the type of recipe that fits your goals.</p>
            </div>
            <RecipeTypeSelector selected={recipeType} onSelect={setRecipeType} />
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={prev}>Back</Button>
              <Button fullWidth icon={<ArrowRight size={16} />} onClick={next}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step 3 — Generate */}
        {step === 3 && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <Logo size="lg" showText={false} className="mx-auto justify-center" />
              <h2 className="text-xl font-bold text-[#1C1917] mt-4">Ready to cook!</h2>
              <p className="text-sm text-[#78716C] mt-1">
                Cheffo Doggo will build a safe, personalized recipe for <strong>{effectiveDog?.name ?? 'your dog'}</strong>.
              </p>
            </div>

            <Card>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#78716C]">Dog</span>
                  <span className="font-medium text-[#1C1917]">{effectiveDog?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#78716C]">Weight</span>
                  <span className="font-medium text-[#1C1917]">{effectiveDog?.weightLbs} lbs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#78716C]">Recipe type</span>
                  <span className="font-medium text-[#1C1917]">
                    {{ full_meal: 'Full Meal', batch_week: 'Weekly Batch', topper: 'Topper', pantry: 'Pantry', treat: 'Treats' }[recipeType]}
                  </span>
                </div>
              </div>
            </Card>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={prev}>Back</Button>
              <Button fullWidth size="lg" icon={<ChefHat size={18} />} loading={loading} onClick={handleGenerate}>
                {loading
                  ? 'Building your recipe & image…'
                  : hasRecipes
                  ? 'Generate Recipe'
                  : 'Generate My First Recipe!'}
              </Button>
            </div>
          </div>
        )}
      </PageWrapper>
    </>
  );
}
