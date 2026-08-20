import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { DogProfileForm } from '../../components/dog/DogProfileForm';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { SHORT_VET_DISCLAIMER } from '../../utils/safetyValidator';
import { consumeGuestDog, lifeStageToApproxAge } from '../../utils/guestTreat';
import { trackFunnelEvent } from '../../lib/funnelAnalytics';

export default function NewProfilePage() {
  const navigate = useNavigate();
  const { profiles, loading, createProfile } = useDogProfiles();

  // If they came through the landing-page guest treat, they already told us
  // their dog's name, weight and life stage — don't make them type it twice.
  // Read once on mount (consuming clears it, so this must not run per-render).
  const [guestDog] = useState(() => consumeGuestDog());

  // Consume the fresh-signup flag (set by the signup page) so a later visit
  // to /signup while logged in goes Home like before.
  useEffect(() => {
    try {
      sessionStorage.removeItem('cheffo:post-signup');
    } catch {
      // sessionStorage unavailable — nothing to clear
    }
  }, []);

  const isFirstDog = !loading && profiles.length === 0;
  const prefilledName = guestDog?.name?.trim();

  return (
    <>
      <Header title="Add Your Dog" backTo="/profiles" backLabel="My Dogs" />
      <PageWrapper>
        {/* First-run "why we ask" hint — keeps the form approachable for
            new signups by explaining the why up front. (CHE-24) */}
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#f4ddc1] bg-[#fff8ee] p-4">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-[#f97316]" aria-hidden="true" />
          <div className="space-y-2 text-sm text-[#7e6b54]">
            {isFirstDog && (
              <p className="font-semibold text-[#5b4a37]">
                {guestDog?.weightLbs
                  ? `We carried ${prefilledName || 'your dog'} over from the recipe you just saw — check the details below and the full recipe is yours. 🦴`
                  : "Let's meet your dog — about 30 seconds, and your first treat recipe is on the house. 🦴"}
              </p>
            )}
            <p>
              <strong className="font-semibold text-[#5b4a37]">Why we ask:</strong>{' '}
              Cheffo uses weight, age, and allergies to personalize portions and run safety checks. Your data is processed only to provide the service, as described in our Privacy Policy.
            </p>
            <p className="text-xs text-[#9c8568]">{SHORT_VET_DISCLAIMER}</p>
          </div>
        </div>
        <DogProfileForm
          initial={
            guestDog
              ? {
                  name: prefilledName || undefined,
                  weightLbs: guestDog.weightLbs,
                  lifeStage: guestDog.lifeStage,
                  // Keep age consistent with the stage they picked — same
                  // midpoint the preview recipe was built from. They can
                  // correct it right here; a contradictory default can't be
                  // spotted at all.
                  ...(guestDog.lifeStage ? lifeStageToApproxAge(guestDog.lifeStage) : {}),
                }
              : undefined
          }
          onSave={async data => {
            // First-ever dog → drop the user straight into recipe creation
            // so the path from signup to first recipe stays smooth. (CHE-24)
            const isFirstDog = profiles.length === 0;
            const created = await createProfile(data);
            await trackFunnelEvent('profile_completed');
            navigate(isFirstDog ? `/bowl-builder?welcome=${encodeURIComponent(created.name)}` : '/profiles');
          }}
          onCancel={() => navigate('/profiles')}
        />
      </PageWrapper>
    </>
  );
}
