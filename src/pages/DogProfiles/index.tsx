import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { useRecipes } from '../../hooks/useRecipes';
import type { DogProfile } from '../../types/dog';

const LIFE_STAGE_LABELS: Record<DogProfile['lifeStage'], string> = {
  puppy: 'Puppy',
  adult: 'Adult',
  senior: 'Senior',
};

const ACTIVITY_LABELS: Record<DogProfile['activityLevel'], string> = {
  low: 'Low',
  moderate: 'Moderate',
  active: 'Active',
  very_active: 'Very Active',
};

function ageLabel(dog: DogProfile): string {
  if (dog.ageYears > 0 && dog.ageMonths > 0) return `${dog.ageYears} yrs ${dog.ageMonths} mo`;
  if (dog.ageYears > 0) return `${dog.ageYears} yrs`;
  return `${dog.ageMonths} mo`;
}

function DogProfileBlock({
  dog,
  progress,
  goal,
  recent,
  onDelete,
}: {
  dog: DogProfile;
  progress: number;
  goal: string;
  recent: string[];
  onDelete: () => void;
}) {
  const navigate = useNavigate();

  return (
    <article className="doggo-card p-5">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-[#eadfce] bg-white p-4">
          <div className="flex items-start gap-4">
            <img src="/cheffo-doggo-logo.png" alt={dog.name} className="h-32 w-32 rounded-3xl border border-[#eadfce] bg-[#fff4ea] object-contain p-2" />
            <div className="min-w-0">
              <h3 className="text-[1.8rem] font-semibold">{dog.name} <span className="text-lg">⭐</span></h3>
              <p className="text-[#7f7469]">{dog.breed} · {ageLabel(dog)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[#6f6459]">
                <div className="rounded-xl bg-[#fff8ef] px-2 py-1">Weight: {dog.weightLbs} lbs</div>
                <div className="rounded-xl bg-[#fff8ef] px-2 py-1">Ideal: {dog.idealWeightLbs ?? dog.weightLbs} lbs</div>
                <div className="rounded-xl bg-[#fff8ef] px-2 py-1">Life Stage: {LIFE_STAGE_LABELS[dog.lifeStage]}</div>
                <div className="rounded-xl bg-[#fff8ef] px-2 py-1">Activity: {ACTIVITY_LABELS[dog.activityLevel]}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#e4efd8] bg-[#f4fbef] p-3 text-sm">
              <p className="font-semibold">Food Preferences</p>
              <p className="mt-1 text-[#6e8767]">
                {dog.pickyEater ? 'Picky eater, prefers familiar textures.' : 'Adventurous eater, open to variety.'}
              </p>
            </div>
            <div className="rounded-2xl border border-[#ffe2ca] bg-[#fff7ef] p-3 text-sm">
              <p className="font-semibold">Favorite Proteins</p>
              <p className="mt-1 text-[#7a6d61]">
                {dog.favoriteProteins.length ? dog.favoriteProteins.join(', ') : 'No favorite proteins set yet.'}
              </p>
            </div>
            <div className="rounded-2xl border border-[#ffd9d9] bg-[#fff2f2] p-3 text-sm">
              <p className="font-semibold">Foods to Avoid</p>
              <p className="mt-1 text-[#9a6767]">
                {dog.avoidFoods.length ? dog.avoidFoods.join(', ') : 'None listed yet.'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-[#eadfce] bg-white p-4">
            <h4 className="font-semibold">Nutrition Goal</h4>
            <p className="mt-1 text-[#6f6459]">{goal}</p>
            <div className="mt-3 h-3 rounded-full bg-[#f4ebdf]">
              <div className="h-3 rounded-full bg-[#43a365]" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-[#8d8278]">
              <span>On track!</span>
              <span>{progress}%</span>
            </div>
            <Button size="sm" variant="secondary" className="mt-3 w-full">View Progress</Button>
          </div>

          <div className="rounded-2xl border border-[#eadfce] bg-white p-4">
            <h4 className="font-semibold">Quick Actions</h4>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="rounded-xl border border-[#eadfce] px-2 py-2 text-sm text-[#6f6459] hover:bg-[#fff8ef]"
                onClick={() => navigate(`/profiles/${dog.id}/edit`)}
              >
                Edit Profile
              </button>
              <button
                className="rounded-xl border border-[#eadfce] px-2 py-2 text-sm text-[#6f6459] hover:bg-[#fff8ef]"
                onClick={() => navigate('/bowl-builder')}
              >
                Create Recipe
              </button>
              <button
                className="rounded-xl border border-[#eadfce] px-2 py-2 text-sm text-[#6f6459] hover:bg-[#fff8ef]"
                onClick={() => navigate('/calculator')}
              >
                Portion Calculator
              </button>
              <button
                className="rounded-xl border border-[#eadfce] px-2 py-2 text-sm text-[#6f6459] hover:bg-[#fff8ef]"
                onClick={() => navigate(`/profiles/${dog.id}/edit`)}
              >
                Allergies
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" icon={<Edit2 size={14} />} onClick={() => navigate(`/profiles/${dog.id}/edit`)}>
                Edit
              </Button>
              <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={onDelete}>
                Delete
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#eadfce] bg-white p-4">
            <h4 className="font-semibold">Recent Recipes</h4>
            <div className="mt-2 space-y-2 text-sm text-[#6f6459]">
              {recent.length ? recent.map(item => <p key={item}>• {item}</p>) : <p>No recipes yet. Create a bowl for {dog.name} to get started.</p>}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function DogProfilesPage() {
  const navigate = useNavigate();
  const { profiles, deleteProfile } = useDogProfiles();
  const { getRecipesByDog } = useRecipes();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const goalsByDog = useMemo(() => {
    return profiles.reduce<Record<string, { goal: string; progress: number }>>((acc, dog) => {
      const hasWeightGoal = typeof dog.idealWeightLbs === 'number' && Math.abs(dog.weightLbs - dog.idealWeightLbs) > 1;
      acc[dog.id] = hasWeightGoal
        ? { goal: dog.weightLbs > (dog.idealWeightLbs ?? dog.weightLbs) ? 'Reach Ideal Weight' : 'Build & Maintain Muscle', progress: 62 }
        : { goal: 'Maintain Healthy Weight', progress: 78 };
      return acc;
    }, {});
  }, [profiles]);

  async function handleDeleteProfile(profileId: string, name: string) {
    const confirmed = window.confirm(`Delete ${name}'s profile? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setDeletingId(profileId);
      await deleteProfile(profileId);
    } catch (error) {
      console.error('Failed to delete profile', error);
      window.alert('Unable to delete profile right now. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell active="dogs">
      <section className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="doggo-section-title">My Dogs ❤️</h1>
          <p className="mt-1 text-[1.1rem] text-[#7e7369]">Manage your dog profiles, nutrition goals, and favorite recipes all in one place.</p>
        </div>
        {profiles.length > 0 && (
          <Button icon={<Plus size={15} />} onClick={() => navigate('/profiles/new')}>Add Another Dog</Button>
        )}
      </section>

      {profiles.length === 0 ? (
        <section className="doggo-card p-8 text-center">
          <h2 className="text-2xl font-semibold text-[#2b2118]">No dog profiles yet</h2>
          <p className="mt-2 text-[#7f7469]">Add your first pup to unlock personalized recipes, treats, and portion guidance.</p>
          <Button className="mt-4" icon={<Plus size={15} />} onClick={() => navigate('/profiles/new')}>
            Add Your First Dog
          </Button>
        </section>
      ) : (
        <div className="space-y-4">
          {profiles.map(dog => {
            const stats = goalsByDog[dog.id] ?? { goal: 'Maintain Healthy Weight', progress: 75 };
            const recent = getRecipesByDog(dog.id)
              .slice(0, 2)
              .map(recipe => recipe.name);

            return (
              <div key={dog.id} className={deletingId === dog.id ? 'opacity-60 pointer-events-none' : ''}>
                <DogProfileBlock
                  dog={dog}
                  progress={stats.progress}
                  goal={stats.goal}
                  recent={recent}
                  onDelete={() => void handleDeleteProfile(dog.id, dog.name)}
                />
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-4 doggo-soft-card grid items-center gap-3 p-4 sm:grid-cols-[220px_1fr_340px]">
        <img src="/cheffo-doggo-logo.png" alt="Cheffo Doggo mascot" className="mx-auto h-40 w-40 object-contain" />
        <div>
          <h3 className="text-[1.4rem] font-semibold">Cheffo Doggo is here for you!</h3>
          <p className="mt-1 text-sm text-[#7f7469]">Every dog is unique, and I'm here to help you create meals that are safe, balanced, and made with love.</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => navigate('/assistant')}>Ask Cheffo Doggo</Button>
        </div>
        <div className="rounded-2xl border border-[#d6ebda] bg-[#f2fbf4] p-4 text-sm text-[#4d8b62]">
          <p className="font-semibold">Safety first, always ✅</p>
          <p className="mt-1 text-xs text-[#5f8b6a]">All recipes use safe, vet-recommended ingredients and are checked against a toxic food database.</p>
        </div>
      </section>
    </AppShell>
  );
}
