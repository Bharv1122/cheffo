import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { useRecipes } from '../../hooks/useRecipes';
import { usePaywall } from '../../hooks/usePaywall';
import { UpgradeModal } from '../../components/paywall/UpgradeModal';
import { generateRecipe } from '../../utils/recipeGenerator';

import { TREAT_CATALOG, FEATURED_TREAT, BIRTHDAY_TREAT, type TreatCategory } from '../../data/treatCatalog';

type TreatTab = TreatCategory;

const TABS: Array<{ key: TreatTab; label: string }> = [
  { key: 'training', label: 'Training Treats' },
  { key: 'frozen', label: 'Frozen Bites' },
  { key: 'birthday', label: 'Birthday Bowls' },
  { key: 'everyday', label: 'Everyday Rewards' },
];

const TREATS = TREAT_CATALOG;

export default function TreatsPage() {
  const navigate = useNavigate();
  const { activeProfile, profiles, loading: profilesLoading } = useDogProfiles();
  const { recipes, saveRecipe, loading: recipesLoading } = useRecipes();
  const { canUseFeature, requireUpgrade, upgradePrompt, dismissUpgradePrompt, isPremium, isLoading: accessLoading } = usePaywall();
  const [activeTab, setActiveTab] = useState<TreatTab>('training');
  const [sortOrder, setSortOrder] = useState<'featured' | 'alphabetical'>('featured');
  const [showAll, setShowAll] = useState(false);
  const [loadingTreat, setLoadingTreat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleTreats = useMemo(() => {
    const selected = showAll ? TREATS : TREATS.filter(treat => treat.category === activeTab);
    return sortOrder === 'alphabetical'
      ? [...selected].sort((a, b) => a.name.localeCompare(b.name))
      : selected;
  }, [activeTab, showAll, sortOrder]);

  async function handleViewTreatRecipe(templateId: string, name: string) {
    if (loadingTreat || accessLoading || profilesLoading || recipesLoading) return;
    if (!activeProfile) {
      setError('Add a dog profile first so Cheffo Doggo can personalize treat recipes.');
      navigate('/profiles/new');
      return;
    }

    setError(null);
    try {
      setLoadingTreat(name);
      const existing = recipes.find(recipe =>
        recipe.dogProfileId === activeProfile.id && recipe.sourceTemplateId === templateId
      );
      if (existing) {
        navigate(`/recipes/${existing.id}`);
        return;
      }
      if (!canUseFeature('treat')) {
        requireUpgrade('treat');
        return;
      }
      const generated = await generateRecipe({
        dog: activeProfile,
        recipeType: 'treat',
        forceTemplateId: templateId,
        skipImage: !isPremium,
      });
      const saved = await saveRecipe(generated);
      navigate(`/recipes/${saved.id}`);
    } catch (e) {
      console.error('Failed to generate treat recipe', e);
      const message = e instanceof Error ? e.message : '';
      // Preserve useful food-safety guidance; do not expose database internals.
      setError(/^(Selected recipe conflicts|Safety check failed|Recipe planning check failed):?/.test(message)
        ? message
        : 'Unable to open this treat recipe right now. Please try again.');
    } finally {
      setLoadingTreat(null);
    }
  }

  return (
    <AppShell
      active="treats"
      rightRail={
        <>
          <section className="doggo-card p-5">
            <h3 className="text-[1.35rem] font-semibold">Featured Treat 🐾</h3>
            <div className="mt-3 rounded-2xl border border-[#eadfce] bg-white p-3">
              <div className="grid h-28 place-items-center rounded-xl bg-[#fff0de] text-5xl">🥕</div>
              <p className="mt-2 rounded-full bg-[#eaf6ea] px-2 py-0.5 text-xs font-semibold text-[#43a365] inline-block">Baked Treat</p>
              <h4 className="mt-2 text-lg font-semibold">{FEATURED_TREAT.name}</h4>
              <p className="mt-1 text-sm text-[#7b7065]">{FEATURED_TREAT.desc}</p>
              <Button size="sm" className="mt-3 w-full" disabled={profilesLoading || recipesLoading || accessLoading || loadingTreat !== null} onClick={() => void handleViewTreatRecipe(FEATURED_TREAT.templateId, FEATURED_TREAT.name)}>
                Open or create recipe
              </Button>
            </div>
          </section>

          <section className="doggo-card p-5">
            <h3 className="text-[1.35rem] font-semibold">Birthday Bowl Spotlight</h3>
            <div className="mt-3 rounded-2xl border border-[#eadfce] bg-white p-3">
              <div className="grid h-24 place-items-center rounded-xl bg-[#f6efff] text-4xl">🎂</div>
              <p className="mt-2 text-lg font-semibold">{BIRTHDAY_TREAT.name}</p>
              <p className="text-sm text-[#7b7065]">{BIRTHDAY_TREAT.desc}</p>
              <Button size="sm" className="mt-3 w-full" disabled={profilesLoading || recipesLoading || accessLoading || loadingTreat !== null} onClick={() => void handleViewTreatRecipe(BIRTHDAY_TREAT.templateId, BIRTHDAY_TREAT.name)}>
                Open or create recipe
              </Button>
            </div>
          </section>

          <section className="rounded-3xl border border-[#d6ebda] bg-[#f2fbf4] p-5 text-sm text-[#4f8f64]">
            <h4 className="font-semibold">Safety & Moderation</h4>
            <ul className="mt-2 space-y-1 text-xs text-[#60896d]">
              <li>✓ Use dog-safe ingredients only.</li>
              <li>✓ Avoid toxic foods like chocolate, onions, grapes, xylitol.</li>
              <li>✓ Treats should be 10% or less of daily calories.</li>
              <li>✓ Introduce new ingredients slowly.</li>
            </ul>
          </section>
        </>
      }
    >
      <UpgradeModal open={upgradePrompt.open} onClose={dismissUpgradePrompt} feature={upgradePrompt.feature} />
      <section className="doggo-soft-card overflow-hidden p-7">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <h1 className="doggo-section-title">Treats & Special Bowls 💗</h1>
            <p className="mt-2 text-[1.2rem] text-[#7f7469]">Wholesome, homemade treats and celebration bowls made with real ingredients—and lots of love.</p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#6f6459]">
              <span>🛡️ Real ingredients</span>
              <span>🧡 Made with love</span>
              <span>✅ Review ingredients for your dog</span>
            </div>
          </div>
          <img src="/cheffo-doggo-logo.png" alt="Cheffo Doggo mascot" className="mx-auto h-56 w-56 object-contain" />
        </div>
      </section>

      {!profilesLoading && profiles.length === 0 && (
        <section className="mt-4 rounded-2xl border border-dashed border-[#f2c8a0] bg-[#fffaf4] p-5 text-center">
          <h2 className="text-lg font-semibold text-[#2b2118]">Add a dog to unlock personalized treats</h2>
          <p className="mt-1 text-sm text-[#7f7469]">Cheffo Doggo tailors treat portions and safety notes to your pup's profile.</p>
          <Button className="mt-3" onClick={() => navigate('/profiles/new')}>Add Dog Profile</Button>
        </section>
      )}

      {error && (
        <section className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </section>
      )}

      <section className="mt-4 doggo-card p-5">
        <div className="flex flex-wrap gap-2 border-b border-[#eadfce] pb-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={tab.key === activeTab}
              className={[
                'rounded-xl px-4 py-2 text-sm font-semibold',
                tab.key === activeTab ? 'bg-[#fff0de] text-[#f97316]' : 'text-[#7d7268] hover:bg-[#fff8ef]',
              ].join(' ')}
              onClick={() => {
                setActiveTab(tab.key);
                setShowAll(false);
              }}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto">
            <label className="sr-only" htmlFor="treat-sort">Sort treats</label>
            <select
              id="treat-sort"
              value={sortOrder}
              onChange={event => setSortOrder(event.target.value as 'featured' | 'alphabetical')}
              className="rounded-xl border border-[#eadfce] bg-white px-4 py-2 text-sm text-[#7a6f64]"
            >
              <option value="featured">Featured order</option>
              <option value="alphabetical">A–Z</option>
            </select>
          </div>
        </div>

        <p className="mt-3 text-sm text-[#8f857a]">Showing {visibleTreats.length} {visibleTreats.length === 1 ? 'recipe' : 'recipes'}</p>

        {visibleTreats.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-[#f2c8a0] bg-[#fffaf4] p-6 text-center">
            <div className="text-4xl">🍪</div>
            <h3 className="mt-2 text-lg font-semibold text-[#2b2118]">No treats in this category yet</h3>
            <p className="mt-1 text-sm text-[#8b8378]">Try another tab — or ask Chef for a custom treat idea.</p>
            <Button size="sm" className="mt-3" onClick={() => navigate('/assistant')}>Ask Chef</Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleTreats.map(treat => (
              <article key={`${treat.category}-${treat.name}`} className="rounded-2xl border border-[#eadfce] bg-white p-3">
                <div className="grid h-36 place-items-center rounded-xl bg-[#fff4ea] text-4xl">🍪</div>
                <p className="mt-2 text-lg font-semibold leading-tight">{treat.name}</p>
                <p className="mt-1 line-clamp-2 text-sm text-[#7f7469]">{treat.desc}</p>
                <p className="mt-2 text-xs text-[#8f857a]">🌟 {treat.level} · See recipe for preparation and freezing times</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {treat.ingredients.map(tag => (
                    <span key={tag} className="rounded-full bg-[#f6efe4] px-2 py-0.5 text-xs font-semibold text-[#8f7d69]">{tag}</span>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  loading={loadingTreat === treat.name}
                  disabled={profilesLoading || recipesLoading || accessLoading || loadingTreat !== null}
                  onClick={() => void handleViewTreatRecipe(treat.templateId, treat.name)}
                >
                  {loadingTreat === treat.name ? 'Creating and saving…' : 'Open or create recipe'}
                </Button>
              </article>
            ))}
          </div>
        )}

        <button
          type="button"
          className="mt-5 w-full rounded-2xl border border-dashed border-[#f2c8a0] py-3 text-sm font-semibold text-[#f97316]"
          onClick={() => setShowAll(current => !current)}
        >
          {showAll ? 'Show selected category only' : `Show all ${TREATS.length} treats`}
        </button>
      </section>
    </AppShell>
  );
}
