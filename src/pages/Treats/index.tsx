import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { useRecipes } from '../../hooks/useRecipes';
import { generateRecipe } from '../../utils/recipeGenerator';

type TreatTab = 'training' | 'frozen' | 'birthday' | 'everyday';

const TABS: Array<{ key: TreatTab; label: string }> = [
  { key: 'training', label: 'Training Treats' },
  { key: 'frozen', label: 'Frozen Bites' },
  { key: 'birthday', label: 'Birthday Bowls' },
  { key: 'everyday', label: 'Everyday Rewards' },
];

const TREATS = [
  { name: 'Blueberry Yogurt Bites', desc: 'Soft, tasty bites packed with antioxidants and probiotic goodness.', time: '20 min', level: 'Easy', tags: ['Dairy', 'Grain-Free'], category: 'frozen' as const, templateId: 'treat_yogurt_berry_lickmat' },
  { name: 'Cheesy Pumpkin Bones', desc: 'Gentle on tummies and perfect for training sessions.', time: '30 min', level: 'Easy', tags: ['Dairy', 'Vegetarian'], category: 'training' as const, templateId: 'treat_pumpkin_oat_biscuits' },
  { name: 'Berry Bliss Paws', desc: 'Cool, refreshing frozen treats for warm days.', time: '10 min', level: 'Easy', tags: ['Fruit', 'Dairy-Free'], category: 'frozen' as const, templateId: 'treat_yogurt_berry_lickmat' },
  { name: 'Peanut Butter Bites', desc: 'A classic favorite for everyday good behavior.', time: '15 min', level: 'Easy', tags: ['Nut-Free Option', 'Grain-Free'], category: 'everyday' as const, templateId: 'treat_pb_banana_bites' },
  { name: 'Mini Birthday Stars', desc: 'Crispy little stars to celebrate your pup\'s big day!', time: '40 min', level: 'Moderate', tags: ['Grain-Free', 'Dog-Safe Color'], category: 'birthday' as const, templateId: 'treat_birthday_bowl' },
  { name: 'Cinnamon Apple Chips', desc: 'Crispy, naturally sweet, and loaded with fiber.', time: '2 hr', level: 'Easy', tags: ['Fruit', 'Grain-Free'], category: 'training' as const, templateId: 'treat_apple_oat_biscuits' },
  { name: 'Minty Fresh Bones', desc: 'Breath-refreshing frozen bites with parsley & mint.', time: '15 min', level: 'Easy', tags: ['Herbal', 'Dairy-Free'], category: 'everyday' as const, templateId: 'treat_frozen_kong' },
  { name: 'Oatmeal Blueberry Drops', desc: 'Soft-baked drops with oats and juicy blueberries.', time: '25 min', level: 'Easy', tags: ['Grain', 'Fruit'], category: 'everyday' as const, templateId: 'treat_apple_oat_biscuits' },
];

export default function TreatsPage() {
  const navigate = useNavigate();
  const { activeProfile, profiles } = useDogProfiles();
  const { saveRecipe } = useRecipes();
  const [activeTab, setActiveTab] = useState<TreatTab>('training');
  const [loadingTreat, setLoadingTreat] = useState<string | null>(null);

  const visibleTreats = useMemo(() => TREATS.filter(treat => treat.category === activeTab), [activeTab]);

  async function handleViewTreatRecipe(templateId: string, name: string) {
    if (!activeProfile) {
      window.alert('Add a dog profile first so Cheffo Doggo can personalize treat recipes.');
      navigate('/profiles/new');
      return;
    }

    try {
      setLoadingTreat(name);
      const generated = await generateRecipe({
        dog: activeProfile,
        recipeType: 'treat',
        forceTemplateId: templateId,
      });
      const saved = await saveRecipe(generated);
      navigate(`/recipes/${saved.id}`);
    } catch (error) {
      console.error('Failed to generate treat recipe', error);
      window.alert('Unable to open this treat recipe right now. Please try again.');
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
            <h3 className="text-[1.35rem] font-semibold">Featured Seasonal Treats 🐾</h3>
            <div className="mt-3 rounded-2xl border border-[#eadfce] bg-white p-3">
              <div className="grid h-28 place-items-center rounded-xl bg-[#fff0de] text-5xl">🥕</div>
              <p className="mt-2 rounded-full bg-[#eaf6ea] px-2 py-0.5 text-xs font-semibold text-[#43a365] inline-block">Spring Special</p>
              <h4 className="mt-2 text-lg font-semibold">Carrot & Pumpkin Spring Snacks</h4>
              <p className="mt-1 text-sm text-[#7b7065]">Bright, crunchy, and full of seasonal goodness.</p>
              <Button size="sm" className="mt-3 w-full" onClick={() => void handleViewTreatRecipe('treat_pumpkin_oat_biscuits', 'Carrot & Pumpkin Spring Snacks')}>
                View Recipe
              </Button>
            </div>
          </section>

          <section className="doggo-card p-5">
            <h3 className="text-[1.35rem] font-semibold">Birthday Bowl Spotlight</h3>
            <div className="mt-3 rounded-2xl border border-[#eadfce] bg-white p-3">
              <div className="grid h-24 place-items-center rounded-xl bg-[#f6efff] text-4xl">🎂</div>
              <p className="mt-2 text-lg font-semibold">Pup's Party Bowl</p>
              <p className="text-sm text-[#7b7065]">A festive, dog-safe bowl made for celebrations.</p>
              <Button size="sm" className="mt-3 w-full" onClick={() => void handleViewTreatRecipe('treat_birthday_bowl', 'Pup\'s Party Bowl')}>
                View Recipe
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
      <section className="doggo-soft-card overflow-hidden p-7">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <h1 className="doggo-section-title">Treats & Special Bowls 💗</h1>
            <p className="mt-2 text-[1.2rem] text-[#7f7469]">Wholesome, homemade treats and celebration bowls made with real ingredients—and lots of love.</p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#6f6459]">
              <span>🛡️ Real ingredients</span>
              <span>🧡 Made with love</span>
              <span>✅ Vet-informed</span>
            </div>
          </div>
          <img src="/cheffo-doggo-logo.png" alt="Cheffo Doggo mascot" className="mx-auto h-56 w-56 object-contain" />
        </div>
      </section>

      {profiles.length === 0 && (
        <section className="mt-4 rounded-2xl border border-dashed border-[#f2c8a0] bg-[#fffaf4] p-5 text-center">
          <h2 className="text-lg font-semibold text-[#2b2118]">Add a dog to unlock personalized treats</h2>
          <p className="mt-1 text-sm text-[#7f7469]">Cheffo Doggo tailors treat portions and safety notes to your pup's profile.</p>
          <Button className="mt-3" onClick={() => navigate('/profiles/new')}>Add Dog Profile</Button>
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
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto">
            <button className="rounded-xl border border-[#eadfce] bg-white px-4 py-2 text-sm text-[#7a6f64]">Sort by Newest</button>
          </div>
        </div>

        <p className="mt-3 text-sm text-[#8f857a]">Showing {visibleTreats.length} recipes</p>

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
                <p className="mt-2 text-xs text-[#8f857a]">⏱ {treat.time} &nbsp; • &nbsp; 🌟 {treat.level}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {treat.tags.map(tag => (
                    <span key={tag} className="rounded-full bg-[#f6efe4] px-2 py-0.5 text-xs font-semibold text-[#8f7d69]">{tag}</span>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="mt-3 w-full"
                  loading={loadingTreat === treat.name}
                  onClick={() => void handleViewTreatRecipe(treat.templateId, treat.name)}
                >
                  View Recipe
                </Button>
              </article>
            ))}
          </div>
        )}

        <button className="mt-5 w-full rounded-2xl border border-dashed border-[#f2c8a0] py-3 text-sm font-semibold text-[#f97316]">+ Load more tasty treats</button>
      </section>
    </AppShell>
  );
}
