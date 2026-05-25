import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { DogProfileForm } from '../../components/dog/DogProfileForm';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { SHORT_VET_DISCLAIMER } from '../../utils/safetyValidator';

export default function NewProfilePage() {
  const navigate = useNavigate();
  const { profiles, createProfile } = useDogProfiles();

  return (
    <>
      <Header title="Add Your Dog" backTo="/profiles" backLabel="My Dogs" />
      <PageWrapper>
        {/* First-run "why we ask" hint — keeps the form approachable for
            new signups by explaining the why up front. (CHE-24) */}
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#f4ddc1] bg-[#fff8ee] p-4">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-[#f97316]" aria-hidden="true" />
          <div className="space-y-2 text-sm text-[#7e6b54]">
            <p>
              <strong className="font-semibold text-[#5b4a37]">Why we ask:</strong>{' '}
              Cheffo uses weight, age, and allergies to personalize portions and run safety checks on every recipe. Your data stays private and is never shared.
            </p>
            <p className="text-xs text-[#9c8568]">{SHORT_VET_DISCLAIMER}</p>
          </div>
        </div>
        <DogProfileForm
          onSave={async data => {
            // First-ever dog → drop the user straight into recipe creation
            // so the path from signup to first recipe stays smooth. (CHE-24)
            const isFirstDog = profiles.length === 0;
            const created = await createProfile(data);
            navigate(isFirstDog ? `/bowl-builder?welcome=${encodeURIComponent(created.name)}` : '/profiles');
          }}
          onCancel={() => navigate('/profiles')}
        />
      </PageWrapper>
    </>
  );
}
