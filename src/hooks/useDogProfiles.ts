import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { generateId, storageGet, storageSet } from '../utils/storage';
import type { DogProfile } from '../types/dog';
import type {
  DogProfileInsert,
  DogProfileRow,
  DogProfileUpdate,
  UserPreferenceInsert,
} from '../types/database';

function toDogProfile(row: DogProfileRow): DogProfile {
  return {
    id: row.id,
    name: row.name,
    breed: row.breed,
    ageYears: row.age_years,
    ageMonths: row.age_months,
    weightLbs: row.weight_lbs,
    idealWeightLbs: row.ideal_weight_lbs ?? undefined,
    lifeStage: row.life_stage,
    activityLevel: row.activity_level,
    mealsPerDay: row.meals_per_day,
    allergies: row.allergies,
    avoidFoods: row.avoid_foods,
    medications: row.medications ?? [],
    favoriteProteins: row.favorite_proteins,
    pickyEater: row.picky_eater,
    texturePreference: row.texture_preference,
    parentSkillLevel: row.parent_skill_level,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDogProfileInsert(
  userId: string,
  data: Omit<DogProfile, 'id' | 'createdAt' | 'updatedAt'>,
  nowIso: string
): DogProfileInsert {
  return {
    user_id: userId,
    name: data.name,
    breed: data.breed,
    age_years: data.ageYears,
    age_months: data.ageMonths,
    weight_lbs: data.weightLbs,
    ideal_weight_lbs: data.idealWeightLbs ?? null,
    life_stage: data.lifeStage,
    activity_level: data.activityLevel,
    meals_per_day: data.mealsPerDay,
    allergies: data.allergies,
    avoid_foods: data.avoidFoods,
    medications: data.medications,
    favorite_proteins: data.favoriteProteins,
    picky_eater: data.pickyEater,
    texture_preference: data.texturePreference,
    parent_skill_level: data.parentSkillLevel,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

function toDogProfileUpdate(data: Partial<DogProfile>, nowIso: string): DogProfileUpdate {
  return {
    name: data.name,
    breed: data.breed,
    age_years: data.ageYears,
    age_months: data.ageMonths,
    weight_lbs: data.weightLbs,
    ideal_weight_lbs: data.idealWeightLbs ?? null,
    life_stage: data.lifeStage,
    activity_level: data.activityLevel,
    meals_per_day: data.mealsPerDay,
    allergies: data.allergies,
    avoid_foods: data.avoidFoods,
    medications: data.medications,
    favorite_proteins: data.favoriteProteins,
    picky_eater: data.pickyEater,
    texture_preference: data.texturePreference,
    parent_skill_level: data.parentSkillLevel,
    updated_at: nowIso,
  };
}

export function useDogProfiles() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const profilesStorageKey = useMemo(() => (userId ? `profiles:${userId}` : 'profiles'), [userId]);
  const activeProfileStorageKey = useMemo(
    () => (userId ? `active-profile:${userId}` : 'active-profile'),
    [userId]
  );

  const [profiles, setProfiles] = useState<DogProfile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mirror state into refs so mutators can read latest values without listing
  // them in deps (which would churn their identity on every state change).
  const profilesRef = useRef(profiles);
  const activeProfileIdRef = useRef(activeProfileId);
  useEffect(() => {
    profilesRef.current = profiles;
    activeProfileIdRef.current = activeProfileId;
  });

  useEffect(() => {
    const stored = storageGet<string | null>(activeProfileStorageKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- key changes on auth events, so we re-sync the active profile from storage.
    setActiveProfileIdState(stored ?? null);
  }, [activeProfileStorageKey]);

  useEffect(() => {
    const client = supabase;
    const currentUserId = userId;

    if (!isSupabaseConfigured || !client || !currentUserId) {
      const localProfiles = storageGet<DogProfile[]>(profilesStorageKey) ?? [];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- userId changes on sign-in/out; we must hydrate profiles from local storage in the no-Supabase branch.
      setProfiles(localProfiles);
      setLoading(false);
      return;
    }

    const supabaseClient = client;
    const authenticatedUserId = currentUserId;
    let isMounted = true;

    async function loadProfiles() {
      setLoading(true);
      setError(null);

      const [profilesResponse, preferencesResponse] = await Promise.all([
        supabaseClient
          .from('dog_profiles')
          .select('*')
          .eq('user_id', authenticatedUserId)
          .order('created_at', { ascending: true }),
        supabaseClient
          .from('user_preferences')
          .select('active_profile_id')
          .eq('user_id', authenticatedUserId)
          .maybeSingle(),
      ]);

      if (!isMounted) return;

      if (profilesResponse.error) {
        setError(profilesResponse.error.message);
        setLoading(false);
        return;
      }

      if (preferencesResponse.error) {
        setError(preferencesResponse.error.message);
        setLoading(false);
        return;
      }

      const nextProfiles = (profilesResponse.data ?? []).map(toDogProfile);
      setProfiles(nextProfiles);

      const preferenceActiveId = preferencesResponse.data?.active_profile_id ?? null;
      if (preferenceActiveId) {
        setActiveProfileIdState(preferenceActiveId);
        storageSet(activeProfileStorageKey, preferenceActiveId);
      } else if (!preferenceActiveId && nextProfiles.length > 0) {
        const fallbackActiveId = storageGet<string | null>(activeProfileStorageKey) ?? nextProfiles[0].id;
        setActiveProfileIdState(fallbackActiveId);
      }

      setLoading(false);
    }

    loadProfiles();

    return () => {
      isMounted = false;
    };
  }, [activeProfileStorageKey, profilesStorageKey, userId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !userId) {
      storageSet(profilesStorageKey, profiles);
    }
  }, [profiles, profilesStorageKey, userId]);

  const setActiveProfileId = useCallback((nextProfileId: string | null) => {
    setActiveProfileIdState(nextProfileId);
    storageSet(activeProfileStorageKey, nextProfileId);

    const client = supabase;
    if (isSupabaseConfigured && client && userId) {
      const nowIso = new Date().toISOString();
      const payload: UserPreferenceInsert = {
        user_id: userId,
        active_profile_id: nextProfileId,
        created_at: nowIso,
        updated_at: nowIso,
      };

      void client.from('user_preferences').upsert(payload, { onConflict: 'user_id' });
    }
  }, [activeProfileStorageKey, userId]);

  const activeProfile = profiles.find(profile => profile.id === activeProfileId) ?? profiles[0] ?? null;

  const createProfile = useCallback(async (
    data: Omit<DogProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DogProfile> => {
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase && userId) {
      const payload = toDogProfileInsert(userId, data, nowIso);
      const { data: createdRow, error: insertError } = await supabase
        .from('dog_profiles')
        .insert(payload)
        .select('*')
        .single();

      if (insertError || !createdRow) {
        throw new Error(insertError?.message ?? 'Could not create profile.');
      }

      const created = toDogProfile(createdRow);
      setProfiles(prev => [...prev, created]);
      if (!activeProfileIdRef.current) {
        setActiveProfileId(created.id);
      }
      return created;
    }

    const profile: DogProfile = {
      ...data,
      id: generateId(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const next = [...profilesRef.current, profile];
    storageSet(profilesStorageKey, next);
    setProfiles(next);
    if (!activeProfileIdRef.current) {
      setActiveProfileId(profile.id);
    }

    return profile;
  }, [profilesStorageKey, setActiveProfileId, userId]);

  const updateProfile = useCallback(async (id: string, data: Partial<DogProfile>): Promise<void> => {
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured && supabase && userId) {
      const payload = toDogProfileUpdate(data, nowIso);
      const { error: updateError } = await supabase
        .from('dog_profiles')
        .update(payload)
        .eq('id', id)
        .eq('user_id', userId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    const next = profilesRef.current.map(profile => (profile.id === id ? { ...profile, ...data, updatedAt: nowIso } : profile));
    if (!isSupabaseConfigured || !supabase || !userId) {
      storageSet(profilesStorageKey, next);
    }
    setProfiles(next);
  }, [profilesStorageKey, userId]);

  const deleteProfile = useCallback(async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase && userId) {
      const { error: deleteError } = await supabase
        .from('dog_profiles')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }

    const remainingProfiles = profilesRef.current.filter(profile => profile.id !== id);
    if (!isSupabaseConfigured || !supabase || !userId) {
      storageSet(profilesStorageKey, remainingProfiles);
    }
    setProfiles(remainingProfiles);

    if (activeProfileIdRef.current === id) {
      setActiveProfileId(remainingProfiles[0]?.id ?? null);
    }
  }, [profilesStorageKey, setActiveProfileId, userId]);

  const getProfile = useCallback((id: string): DogProfile | undefined => {
    return profiles.find(profile => profile.id === id);
  }, [profiles]);

  return {
    profiles,
    activeProfile,
    activeProfileId,
    loading,
    error,
    setActiveProfileId,
    createProfile,
    updateProfile,
    deleteProfile,
    getProfile,
  };
}
