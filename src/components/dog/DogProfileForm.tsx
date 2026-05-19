import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Toggle } from '../ui/Toggle';
import { Button } from '../ui/Button';
import type { DogProfile, LifeStage, ActivityLevel, TexturePreference, SkillLevel } from '../../types/dog';

type FormData = Omit<DogProfile, 'id' | 'createdAt' | 'updatedAt'>;

interface Props {
  initial?: Partial<FormData>;
  onSave: (data: FormData) => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

const LIFE_STAGE_OPTIONS = [
  { value: 'puppy', label: 'Puppy (under 1 year)' },
  { value: 'adult', label: 'Adult (1–7 years)' },
  { value: 'senior', label: 'Senior (7+ years)' },
];

const ACTIVITY_OPTIONS = [
  { value: 'low',       label: 'Low — mostly lounging' },
  { value: 'moderate',  label: 'Moderate — daily walks' },
  { value: 'active',    label: 'Active — lots of exercise' },
  { value: 'very_active', label: 'Very Active — working/sport dog' },
];

const TEXTURE_OPTIONS = [
  { value: 'soft',       label: 'Soft / Mashed' },
  { value: 'chunky',     label: 'Chunky / Diced' },
  { value: 'brothy',     label: 'Brothy / Moist' },
  { value: 'dry_topper', label: 'Dry Topper / Crumble' },
];

const SKILL_OPTIONS = [
  { value: 'beginner',        label: 'Beginner — just starting out' },
  { value: 'some_experience', label: 'Some experience — comfortable in the kitchen' },
  { value: 'very_comfortable', label: 'Very comfortable — experienced cook' },
];

const PROTEIN_OPTIONS = ['Chicken', 'Turkey', 'Beef', 'Salmon', 'Whitefish', 'Lamb', 'Eggs', 'Venison'];

const defaults: FormData = {
  name: '', breed: '', ageYears: 1, ageMonths: 0, weightLbs: 25,
  idealWeightLbs: undefined, lifeStage: 'adult', activityLevel: 'moderate',
  mealsPerDay: 2, allergies: [], avoidFoods: [], medications: [], favoriteProteins: [],
  pickyEater: false, texturePreference: 'chunky', parentSkillLevel: 'beginner',
};

export function DogProfileForm({ initial, onSave, onCancel, loading }: Props) {
  // Filter out undefined values so old localStorage profiles missing the new
  // `medications` field fall back to the default empty array instead of undefined.
  const seed: FormData = { ...defaults };
  if (initial) {
    for (const [k, v] of Object.entries(initial)) {
      if (v !== undefined) (seed as Record<string, unknown>)[k] = v;
    }
  }
  const [form, setForm] = useState<FormData>(seed);
  const [allergyInput, setAllergyInput] = useState('');
  const [avoidInput, setAvoidInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function set<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  type TagField = 'allergies' | 'avoidFoods' | 'medications';

  function addTag(field: TagField, value: string, clear: () => void) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!(form[field] as string[]).includes(trimmed)) {
      set(field, [...(form[field] as string[]), trimmed] as string[]);
    }
    clear();
  }

  function removeTag(field: TagField, value: string) {
    set(field, (form[field] as string[]).filter(v => v !== value) as string[]);
  }

  function toggleProtein(protein: string) {
    const current = form.favoriteProteins;
    set('favoriteProteins', current.includes(protein)
      ? current.filter(p => p !== protein)
      : [...current, protein]);
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Dog name is required';
    if (!form.breed.trim()) e.breed = 'Breed is required';
    if (!form.weightLbs || form.weightLbs <= 0) e.weightLbs = 'Weight must be greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic info */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-[#78716C] uppercase tracking-wide">About Your Dog</h2>
        <Input label="Dog's Name" value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} required placeholder="e.g. Biscuit" />
        <Input label="Breed" value={form.breed} onChange={e => set('breed', e.target.value)} error={errors.breed} required placeholder="e.g. Golden Retriever" />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Age (years)" type="number" min={0} max={25} value={form.ageYears} onChange={e => set('ageYears', Number(e.target.value))} />
          <Input label="Age (months)" type="number" min={0} max={11} value={form.ageMonths} onChange={e => set('ageMonths', Number(e.target.value))} hint="Extra months" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Current Weight (lbs)" type="number" min={1} max={250} value={form.weightLbs} onChange={e => set('weightLbs', Number(e.target.value))} error={errors.weightLbs} required />
          <Input label="Ideal Weight (lbs)" type="number" min={1} max={250} value={form.idealWeightLbs ?? ''} onChange={e => set('idealWeightLbs', e.target.value ? Number(e.target.value) : undefined)} hint="Optional" />
        </div>

        <Select label="Life Stage" value={form.lifeStage} onChange={e => set('lifeStage', e.target.value as LifeStage)} options={LIFE_STAGE_OPTIONS} required />
        <Select label="Activity Level" value={form.activityLevel} onChange={e => set('activityLevel', e.target.value as ActivityLevel)} options={ACTIVITY_OPTIONS} required />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Meals Per Day" type="number" min={1} max={6} value={form.mealsPerDay} onChange={e => set('mealsPerDay', Number(e.target.value))} required />
          <Select label="Texture Preference" value={form.texturePreference} onChange={e => set('texturePreference', e.target.value as TexturePreference)} options={TEXTURE_OPTIONS} />
        </div>

        <Select label="Your Cooking Skill Level" value={form.parentSkillLevel} onChange={e => set('parentSkillLevel', e.target.value as SkillLevel)} options={SKILL_OPTIONS} />
      </section>

      {/* Favorite proteins */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#78716C] uppercase tracking-wide">Favorite Proteins</h2>
        <div className="flex flex-wrap gap-2">
          {PROTEIN_OPTIONS.map(p => (
            <button type="button" key={p} onClick={() => toggleProtein(p)}
              className={['px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                form.favoriteProteins.includes(p)
                  ? 'bg-[#F97316] border-[#F97316] text-white'
                  : 'bg-white border-[#E7E5E4] text-[#78716C] hover:border-[#F97316]',
              ].join(' ')}>
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* Picky eater */}
      <section>
        <Toggle checked={form.pickyEater} onChange={v => set('pickyEater', v)} label="Picky eater" hint="Cheffo Doggo will favor strongly-appealing ingredients" />
      </section>

      {/* Allergies */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#78716C] uppercase tracking-wide">Allergies</h2>
        <div className="flex gap-2">
          <input
            value={allergyInput}
            onChange={e => setAllergyInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('allergies', allergyInput, () => setAllergyInput('')); }}}
            placeholder="Type and press Enter (e.g. chicken)"
            className="flex-1 rounded-xl border border-[#E7E5E4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => addTag('allergies', allergyInput, () => setAllergyInput(''))}>Add</Button>
        </div>
        {form.allergies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.allergies.map(a => (
              <span key={a} className="inline-flex items-center gap-1 bg-red-100 text-red-700 rounded-full px-3 py-1 text-sm">
                {a}
                <button type="button" onClick={() => removeTag('allergies', a)} className="hover:text-red-900 ml-1">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Medications */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#78716C] uppercase tracking-wide">Current Medications</h2>
        <p className="text-xs text-[#78716C]">Used for safety checks against ingredient/supplement interactions (e.g. Rimadyl, insulin, warfarin)</p>
        <div className="flex gap-2">
          <input
            value={medicationInput}
            onChange={e => setMedicationInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('medications', medicationInput, () => setMedicationInput('')); }}}
            placeholder="Type and press Enter (e.g. Rimadyl)"
            className="flex-1 rounded-xl border border-[#E7E5E4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => addTag('medications', medicationInput, () => setMedicationInput(''))}>Add</Button>
        </div>
        {form.medications.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.medications.map(m => (
              <span key={m} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm">
                {m}
                <button type="button" onClick={() => removeTag('medications', m)} className="hover:text-blue-900 ml-1">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Avoid foods */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#78716C] uppercase tracking-wide">Foods to Avoid</h2>
        <p className="text-xs text-[#78716C]">Not allergies, but foods you prefer to leave out</p>
        <div className="flex gap-2">
          <input
            value={avoidInput}
            onChange={e => setAvoidInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('avoidFoods', avoidInput, () => setAvoidInput('')); }}}
            placeholder="Type and press Enter (e.g. beef)"
            className="flex-1 rounded-xl border border-[#E7E5E4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => addTag('avoidFoods', avoidInput, () => setAvoidInput(''))}>Add</Button>
        </div>
        {form.avoidFoods.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.avoidFoods.map(a => (
              <span key={a} className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 rounded-full px-3 py-1 text-sm">
                {a}
                <button type="button" onClick={() => removeTag('avoidFoods', a)} className="hover:text-amber-900 ml-1">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel} fullWidth>Cancel</Button>}
        <Button type="submit" loading={loading} fullWidth>Save Profile</Button>
      </div>
    </form>
  );
}
