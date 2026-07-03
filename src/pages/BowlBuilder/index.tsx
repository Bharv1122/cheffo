import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChefHat, Sparkles } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { RecipeTypeSelector } from '../../components/recipe/RecipeTypeSelector';
import { UpgradeModal } from '../../components/paywall/UpgradeModal';
import { useRecipes } from '../../hooks/useRecipes';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { usePaywall, type PaywallFeature } from '../../hooks/usePaywall';
import { generateRecipe } from '../../utils/recipeGenerator';
import type { RecipeType } from '../../types/recipe';

function recipeTypeToPaywallFeature(type: RecipeType): PaywallFeature {
  if (type === 'full_meal') return 'full_meal';
  if (type === 'batch_week') return 'batch_week';
  if (type === 'topper') return 'topper';
  if (type === 'pantry') return 'pantry';
  return 'treat';
}

export default function BowlBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Set by /profiles/new after the user saves their very first dog (CHE-24)
  // so we can greet them with a "Now let's make a recipe for X" line instead
  // of dropping them on a generic form.
  const welcomeDogName = searchParams.get('welcome');
  const { saveRecipe } = useRecipes();
  const { activeProfile, profiles, loading: profilesLoading } = useDogProfiles();

  const [chosenType, setChosenType] = useState<RecipeType | null>(null);
  const [dogId, setDogId] = useState(activeProfile?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dog = profiles.find(p => p.id === dogId) ?? activeProfile;
  const { canUseFeature, requireUpgrade, upgradePrompt, dismissUpgradePrompt, isPremium, isLoading: paywallLoading, treatRecipesRemaining } = usePaywall();
  // Free-plan funnel: until the user picks a type themselves, default free
  // users who still have their free treat to the treat option (their included
  // taste) instead of a premium type. Derived, not effect-set, so the async
  // paywall load can't overwrite a manual selection.
  const highlightFreeTreat = !paywallLoading && !isPremium && treatRecipesRemaining > 0;
  const recipeType: RecipeType = chosenType ?? (highlightFreeTreat ? 'treat' : 'full_meal');
  const paywallFeature = recipeTypeToPaywallFeature(recipeType);
  // Don't treat "subscription still loading" as blocked — otherwise a premium
  // user's first click fires the upgrade modal before isPremium resolves.
  const isGenerationBlocked = !paywallLoading && !canUseFeature(paywallFeature);

  // First-run onboarding: if the user has no dog profiles yet, bounce them to
  // profile creation. Replaces the wizard's first-step handholding. (CHE-125)
  useEffect(() => {
    if (!profilesLoading && profiles.length === 0) {
      navigate('/profiles/new', { replace: true });
    }
  }, [profilesLoading, profiles.length, navigate]);

  async function handleGenerate() {
    // Subscription state not loaded yet — ignore the click rather than firing
    // the upgrade modal against a not-yet-known premium status.
    if (paywallLoading) return;
    if (!dog) { setError('Please add a dog profile first.'); return; }
    // Paywall gate: free users can make exactly one treat. Everything else
    // requires Premium. (CHE-36)
    if (!canUseFeature(paywallFeature)) {
      requireUpgrade(paywallFeature);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const recipe = await generateRecipe({
        dog,
        recipeType,
        // Batch recipes always feed for a week. Other types make a single meal.
        batchDuration: recipeType === 'batch_week' ? '7day' : '1day',
      });
      const saved = await saveRecipe(recipe);
      navigate(`/recipes/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate recipe. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header title="Bowl Builder" backTo="/" />
      <PageWrapper>
        {welcomeDogName && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#f4ddc1] bg-[#fff8ee] p-4">
            <ChefHat size={18} className="mt-0.5 shrink-0 text-[#f97316]" aria-hidden="true" />
            <p className="text-sm text-[#7e6b54]">
              <strong className="font-semibold text-[#5b4a37]">Welcome!</strong>{' '}
              Now let's make a recipe for {welcomeDogName}. Pick a type below and Cheffo handles the rest.
            </p>
          </div>
        )}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#1C1917]">Build Your Bowl</h2>
          <p className="text-sm text-[#78716C] mt-1">
            Pick a recipe type and Cheffo Doggo chooses balanced, dog-safe ingredients and builds the full recipe — portions, shopping list, and steps.
          </p>
        </div>

        <div className="space-y-4">
          {/* Dog selector */}
          {profiles.length > 0 && (
            <Card>
              <Select
                label="For which dog?"
                value={dogId}
                onChange={e => setDogId(e.target.value)}
                options={profiles.map(p => ({ value: p.id, label: p.name }))}
              />
            </Card>
          )}

          {/* Recipe type */}
          <Card>
            <h3 className="font-semibold text-[#1C1917] text-sm mb-3">What kind of recipe?</h3>
            <RecipeTypeSelector selected={recipeType} onSelect={t => setChosenType(t)} highlightFreeTreat={highlightFreeTreat} />
          </Card>

          {recipeType === 'batch_week' && (
            <p className="rounded-lg bg-[#fff7ee] border border-[#f2c8a0] px-3 py-2 text-xs text-[#a16b38]">
              📦 Batch recipes feed your dog for <strong>7 days</strong>. Cheffo Doggo will scale everything to a full week.
            </p>
          )}

          {!dog && (
            <Disclaimer variant="warning">
              You need a dog profile before generating a recipe. <a href="/profiles/new" className="underline font-medium">Add a dog</a> first.
            </Disclaimer>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
          )}

          {!isPremium && isGenerationBlocked && (
            <div className="rounded-xl border border-[#f4ddc1] bg-[#fff8ee] p-4 text-sm text-[#7e6b54]">
              <p className="font-semibold text-[#5b4a37] flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#f97316]" aria-hidden="true" />
                Premium required
              </p>
              <p className="mt-1">
                {recipeType === 'treat'
                  ? "You've already made your free treat recipe. Upgrade to make unlimited recipes."
                  : 'Full meals, batches, toppers, and pantry mode are part of Cheffo Doggo Premium. $8/mo or $59/yr with a 14-day money-back guarantee.'}
              </p>
            </div>
          )}

          {!isPremium && !isGenerationBlocked && recipeType === 'treat' && (
            <p className="rounded-xl border border-[#d6ebda] bg-[#f2fbf4] px-3 py-2 text-xs text-[#4f8f64]">
              ✨ Free taste: {treatRecipesRemaining} treat recipe remaining. Upgrade for unlimited.
            </p>
          )}

          <Button
            fullWidth
            size="lg"
            loading={loading || paywallLoading}
            icon={isGenerationBlocked ? <Sparkles size={18} /> : <ChefHat size={18} />}
            onClick={handleGenerate}
            disabled={!dog || paywallLoading}
          >
            {loading
              ? 'Generating recipe & image…'
              : paywallLoading
                ? 'Loading…'
                : isGenerationBlocked
                  ? 'Upgrade to generate'
                  : 'Generate Recipe'}
          </Button>
        </div>
      </PageWrapper>
      <UpgradeModal
        open={upgradePrompt.open}
        onClose={dismissUpgradePrompt}
        feature={upgradePrompt.feature}
      />
    </>
  );
}
