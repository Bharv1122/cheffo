import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator,
  CalendarDays,
  ChefHat,
  MessageCircle,
  Package,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { useRecipes } from '../../hooks/useRecipes';
import { useApprovals } from '../../hooks/useApprovals';
import { useAuth } from '../../contexts/AuthContext';
import { getRecipePhoto } from '../../utils/recipeInsights';
import { storageGet, storageSet } from '../../utils/storage';
import { SHORT_VET_DISCLAIMER } from '../../utils/safetyValidator';

const APPROVALS_LAST_SEEN_KEY = 'approvals-last-seen';
const WELCOME_SEEN_KEY = 'onboarding-seen';

const QUICK_ACTIONS = [
  { label: 'Full Meals', desc: 'Create complete balanced homemade recipes', icon: <ChefHat size={18} />, to: '/bowl-builder', color: 'bg-[#fff0de] text-[#f97316]' },
  { label: 'Batch Cook', desc: 'Cook once, feed all week with freezer plans', icon: <CalendarDays size={18} />, to: '/bowl-builder', color: 'bg-[#ffe8cf] text-[#f97316]', tag: 'Popular' },
  { label: 'Pantry Mode', desc: 'Use what you already have in your kitchen', icon: <Package size={18} />, to: '/pantry', color: 'bg-[#eaf6ea] text-[#43a365]' },
  { label: 'Treats', desc: 'Healthy homemade treats for training & rewards', icon: <Sparkles size={18} />, to: '/treats', color: 'bg-[#ffe8e8] text-[#ef6f5d]' },
  { label: 'Calculator', desc: 'Estimate portions, calories & batch sizes', icon: <Calculator size={18} />, to: '/calculator', color: 'bg-[#efe9ff] text-[#7f56d9]' },
  { label: 'Ask Chef', desc: 'Get AI-powered answers for your questions', icon: <MessageCircle size={18} />, to: '/assistant', color: 'bg-[#e9f8f5] text-[#1f9f84]' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { profiles, loading: profilesLoading } = useDogProfiles();
  const { recipes } = useRecipes();
  const { user } = useAuth();

  // First-run welcome modal — shown once per user (not per device) for
  // users who haven't created any dogs yet. Scoping the seen-flag by
  // user.id means a second account signing up on the same browser still
  // gets the welcome. Gates: not seen + profiles done hydrating + no
  // profiles. (CHE-24)
  const welcomeSeenKey = `${WELCOME_SEEN_KEY}:${user?.id ?? 'guest'}`;
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (profilesLoading) return;
    if (storageGet<boolean>(welcomeSeenKey)) return;
    if (profiles.length > 0) {
      // Existing user who has dogs already → flag as seen so we don't pop
      // it later if they ever delete all their dogs.
      storageSet(welcomeSeenKey, true);
      return;
    }
    setShowWelcome(true);
  }, [profilesLoading, profiles.length, welcomeSeenKey]);

  const dismissWelcome = useCallback(() => {
    storageSet(welcomeSeenKey, true);
    setShowWelcome(false);
  }, [welcomeSeenKey]);

  const startFromWelcome = useCallback(() => {
    storageSet(welcomeSeenKey, true);
    setShowWelcome(false);
    navigate('/profiles/new');
  }, [navigate, welcomeSeenKey]);

  const userName = user?.email?.split('@')[0] ?? 'there';
  // Gate "first recipe" copy on whether they have any. (CHE-117)
  const hasRecipes = recipes.length > 0;

  // In-app banner for approvals received since the user's last visit. The
  // "last seen" timestamp lives in localStorage so dismissing it persists
  // across navigations without a round-trip. (CHE-124)
  const { approvalsSince } = useApprovals();
  const [lastSeenIso, setLastSeenIso] = useState<string | null>(
    () => storageGet<string | null>(APPROVALS_LAST_SEEN_KEY) ?? null
  );
  const newApprovals = approvalsSince(lastSeenIso);
  const dismissApprovalsBanner = useCallback(() => {
    const now = new Date().toISOString();
    storageSet(APPROVALS_LAST_SEEN_KEY, now);
    setLastSeenIso(now);
  }, []);

  const recentRecipes = recipes.slice(-3).reverse().map(recipe => ({
    id: recipe.id,
    name: recipe.name,
    date: new Date(recipe.createdAt).toLocaleDateString(),
    cal: recipe.nutrition.caloriesPerServing,
    photo: getRecipePhoto(recipe),
  }));

  return (
    <AppShell
      active="home"
      rightRail={
        <>
          <section className="doggo-card p-5">
            <h3 className="text-[1.4rem] font-semibold text-[#2b2118]">
              {hasRecipes ? 'Build another bowl' : 'Build your first bowl'}
            </h3>
            <p className="mt-2 text-sm text-[#8b8378]">
              Pick a dog and a recipe type — Cheffo Doggo chooses balanced, safe ingredients and builds the full recipe in seconds.
            </p>
            <Button className="mt-4 w-full" onClick={() => navigate('/bowl-builder')}>
              {hasRecipes ? 'New recipe' : 'Start now'}
            </Button>
          </section>

          <section className="rounded-3xl border border-[#d6ebda] bg-[#f2fbf4] p-5 text-sm text-[#4d8c62]">
            <h4 className="font-semibold">Safety first, always</h4>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-[#5f8c6a]">
              <li>• All recipes use safe, vet-recommended ingredients</li>
              <li>• Ingredients are checked against toxic-food database</li>
              <li>• Education only, not a substitute for veterinary advice</li>
            </ul>
          </section>
        </>
      }
    >
      {newApprovals.length > 0 && (
        <section className="rounded-2xl border border-[#bfe7cb] bg-[#e9f7ee] p-4 text-[#235d38] mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <ShieldCheck size={20} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">
                  {newApprovals.length === 1
                    ? `${newApprovals[0].vetName ? `Dr. ${newApprovals[0].vetName} DVM` : 'Your vet'} approved a recipe`
                    : `${newApprovals.length} new vet approvals`}
                </p>
                <ul className="mt-1 space-y-1 text-sm">
                  {newApprovals.slice(0, 4).map((approval) => {
                    const matchedRecipe = recipes.find((r) => r.id === approval.recipeId);
                    return (
                      <li key={approval.id}>
                        <button
                          type="button"
                          className="text-left underline-offset-2 hover:underline"
                          onClick={() => {
                            dismissApprovalsBanner();
                            navigate(`/recipes/${approval.recipeId}`);
                          }}
                        >
                          {matchedRecipe?.name ?? 'Recipe'}{' '}
                          {approval.status === 'approved_with_notes' && (
                            <span className="opacity-75">(with notes)</span>
                          )}{' '}
                          → open
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <button
              type="button"
              className="text-xs underline opacity-80 hover:opacity-100"
              onClick={dismissApprovalsBanner}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      <section className="doggo-soft-card overflow-hidden p-7">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <h1 className="doggo-section-title">Welcome back, {userName}! 👋</h1>
            <p className="mt-2 text-[1.2rem] text-[#7f7469]">Let's make something amazing for your pup today.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/75 p-3">
                <ShieldCheck className="text-[#43a365]" size={18} />
                <p className="mt-1 text-sm font-semibold">Safety first</p>
                <p className="text-xs text-[#867c71]">Every recipe is ingredient checked</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-3">
                <Calculator className="text-[#f59e0b]" size={18} />
                <p className="mt-1 text-sm font-semibold">Portion math</p>
                <p className="text-xs text-[#867c71]">Calorie & batch size calculated</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-3">
                <UtensilsCrossed className="text-[#f97316]" size={18} />
                <p className="mt-1 text-sm font-semibold">Made for real life</p>
                <p className="text-xs text-[#867c71]">Budget, pantry & weekly plans</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-5 rounded-full bg-[#ffe6cf] blur-2xl" />
            <img src="/cheffo-doggo-logo.png" alt="Cheffo Doggo mascot" className="relative mx-auto h-64 w-64 object-contain" />
          </div>
        </div>
      </section>

      <section className="mt-5 doggo-card p-5">
        <h2 className="text-[1.6rem] font-semibold">Quick Actions</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_ACTIONS.map(action => (
            <button
              type="button"
              key={action.label}
              onClick={() => navigate(action.to)}
              className="group rounded-2xl border border-[#eadfce] bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#f2c8a0]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={[action.color, 'grid h-10 w-10 place-items-center rounded-xl'].join(' ')}>{action.icon}</span>
                {action.tag && <span className="rounded-full bg-[#fff3e4] px-2 py-0.5 text-xs font-semibold text-[#f97316]">{action.tag}</span>}
              </div>
              <h3 className="mt-3 text-base font-semibold text-[#2b2118]">{action.label}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#8b8378]">{action.desc}</p>
            </button>
          ))}
        </div>

      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="doggo-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[1.3rem] font-semibold">Recent Recipes</h3>
            <button onClick={() => navigate('/recipes')} className="text-sm font-semibold text-[#f97316]">View all</button>
          </div>
          {recentRecipes.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#f2c8a0] bg-[#fffaf4] p-5 text-center">
              <p className="font-semibold text-[#2b2118]">No recipes yet</p>
              <p className="mt-1 text-sm text-[#8b8378]">Start your first bowl and your saved recipes will appear here.</p>
              <Button size="sm" className="mt-3" onClick={() => navigate('/bowl-builder')}>Create Recipe</Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {recentRecipes.map(recipe => (
                <button
                  key={recipe.id}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#eadfce] bg-white p-3 text-left hover:bg-[#fff8ef]"
                  onClick={() => navigate(`/recipes/${recipe.id}`)}
                >
                  <div className="h-14 w-14 overflow-hidden rounded-xl border border-[#eadfce] bg-[#fff4ea]">
                    <img
                      src={recipe.photo.src}
                      alt={recipe.photo.alt}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{recipe.name}</p>
                    <p className="text-sm text-[#8b8378]">{recipe.cal} kcal/cup</p>
                  </div>
                  <p className="text-xs text-[#9a9186]">{recipe.date}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="doggo-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[1.3rem] font-semibold">My Dogs</h3>
            <button onClick={() => navigate('/profiles')} className="text-sm font-semibold text-[#f97316]">View all</button>
          </div>
          {profiles.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#f2c8a0] bg-[#fffaf4] p-5 text-center">
              <p className="font-semibold text-[#2b2118]">No dog profiles yet</p>
              <p className="mt-1 text-sm text-[#8b8378]">Add your first pup to personalize meals and portions.</p>
              <Button size="sm" className="mt-3" onClick={() => navigate('/profiles/new')}>Add Dog Profile</Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {profiles.map(dog => (
                <div key={dog.id} className="flex items-center gap-3 rounded-2xl border border-[#eadfce] bg-white p-3">
                  <img src="/cheffo-doggo-logo.png" alt={dog.name} className="h-14 w-14 rounded-full border border-[#eadfce] object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{dog.name}</p>
                    <p className="text-sm text-[#8b8378]">{dog.breed} · {dog.ageYears > 0 ? `${dog.ageYears} yrs` : `${dog.ageMonths} mo`}</p>
                  </div>
                  <span className="rounded-xl bg-[#f9f1e6] px-3 py-1 text-xs font-semibold text-[#7f7469]">{dog.weightLbs} lbs</span>
                </div>
              ))}
              <button onClick={() => navigate('/profiles/new')} className="w-full rounded-2xl border border-dashed border-[#f2c8a0] py-3 text-sm font-semibold text-[#f97316]">+ Add Another Dog</button>
            </div>
          )}
        </div>
      </section>

      <p className="mt-4 text-center text-xs text-[#9c9288]">Your data is private and secure. We never share your information.</p>

      <Modal
        open={showWelcome}
        onClose={dismissWelcome}
        title="Welcome to Cheffo Doggo 🐾"
        size="md"
        footer={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={dismissWelcome}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#7f7469] hover:text-[#2b2118]"
            >
              I'll explore first
            </button>
            <Button onClick={startFromWelcome}>Add Your First Dog</Button>
          </div>
        )}
      >
        <p className="text-sm leading-relaxed text-[#5f5650]">
          Hi {userName}! Cheffo Doggo makes vet-informed homemade meals for your dog in seconds. Here's what you can do:
        </p>
        <ul className="mt-4 space-y-3 text-sm text-[#3a302a]">
          <li className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff0de] text-[#f97316]">
              <ShieldCheck size={18} />
            </span>
            <span>
              <strong className="block font-semibold">Safety-checked recipes</strong>
              <span className="text-[#7f7469]">Every ingredient is screened against your dog's allergies and meds.</span>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eaf6ea] text-[#43a365]">
              <ChefHat size={18} />
            </span>
            <span>
              <strong className="block font-semibold">Personalized portions</strong>
              <span className="text-[#7f7469]">Calorie math, batch sizing, and shopping lists tuned to your pup.</span>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#efe9ff] text-[#7f56d9]">
              <Sparkles size={18} />
            </span>
            <span>
              <strong className="block font-semibold">Your vet, in the loop</strong>
              <span className="text-[#7f7469]">Request your own vet's approval on any recipe — they fill out a one-page form.</span>
            </span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-[#9c9288]">
          One step to get started: add your dog's profile (weight, age, allergies). Takes about a minute.
        </p>
        <p className="mt-3 rounded-xl border border-[#e7e5e4] bg-[#fafaf9] px-3 py-2 text-xs leading-relaxed text-[#78716C]">
          {SHORT_VET_DISCLAIMER}
        </p>
      </Modal>
    </AppShell>
  );
}
