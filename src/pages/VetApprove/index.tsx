import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, MessageSquareWarning, ShieldAlert, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';
import {
  fetchApprovalByToken,
  submitVetApproval,
  type PublicApprovalView,
} from '../../lib/approvals';
import type { Recipe } from '../../types/recipe';
import { computeSuggestedDoses } from '../../utils/supplementDosing';

type Decision = 'approve' | 'approve_with_notes' | 'decline';

const MAX_NOTES = 500;

function NutritionCallout({ recipe }: { recipe: Recipe }) {
  const totalGrams = recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.amountGrams, 0);
  const proteinGrams = recipe.ingredients
    .filter(ingredient => ingredient.category === 'protein')
    .reduce((sum, ingredient) => sum + ingredient.amountGrams, 0);
  const proteinPct = totalGrams > 0 ? Math.round((proteinGrams / totalGrams) * 100) : 0;

  const items: Array<{ label: string; value: string }> = [
    { label: 'kcal / day', value: `${Math.round(recipe.nutrition.caloriesPerDay)}` },
    { label: 'kcal / serving', value: `${Math.round(recipe.nutrition.caloriesPerServing)}` },
    { label: 'Protein (by mass)', value: `${proteinPct}%` },
    { label: 'Meals per day', value: `${recipe.serving.mealsPerDay}` },
    { label: 'Total daily food', value: `${Math.round(recipe.serving.totalDailyGrams)} g` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-xl bg-[#FFF6EC] border border-[#F7D8B6] p-3">
      {items.map(item => (
        <div key={item.label} className="text-center">
          <div className="text-xs uppercase tracking-wide text-[#9C7B52]">{item.label}</div>
          <div className="text-base font-semibold text-[#2B2118]">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function StatusBanner({ view }: { view: PublicApprovalView }) {
  const { approval } = view;
  if (approval.tokenExpired) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#FCD9B6] bg-[#FFF6EC] p-4 text-[#7C5018]">
        <ShieldAlert className="h-5 w-5 mt-0.5" />
        <div>
          <p className="font-semibold">This approval link has expired.</p>
          <p className="text-sm">Please ask the patient's owner to send a fresh request through Cheffo.</p>
        </div>
      </div>
    );
  }
  if (approval.status === 'approved' || approval.status === 'approved_with_notes') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#BFE7CB] bg-[#E9F7EE] p-4 text-[#235D38]">
        <Check className="h-5 w-5 mt-0.5" />
        <div>
          <p className="font-semibold">You already approved this recipe.</p>
          <p className="text-sm">Thanks — the family has been notified.</p>
        </div>
      </div>
    );
  }
  if (approval.status === 'declined') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#F4C5C5] bg-[#FDECEC] p-4 text-[#8A2C2C]">
        <X className="h-5 w-5 mt-0.5" />
        <div>
          <p className="font-semibold">You declined to recommend this recipe.</p>
          {approval.notes && <p className="text-sm">Your notes: {approval.notes}</p>}
        </div>
      </div>
    );
  }
  return null;
}

export default function VetApprovePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [view, setView] = useState<PublicApprovalView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [decision, setDecision] = useState<Decision | null>(null);
  const [notes, setNotes] = useState('');
  const [vetName, setVetName] = useState('');
  const [vetPractice, setVetPractice] = useState('');
  const [vetState, setVetState] = useState('');
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [doses, setDoses] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchApprovalByToken(token)
      .then(result => {
        if (cancelled) return;
        setView(result);
        const prefill = result.vetPrefill;
        if (prefill) {
          setVetName(prefill.name ?? '');
          setVetPractice(prefill.practice ?? '');
          setVetState(prefill.state ?? '');
        }
      })
      .catch(error => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const recipe = view?.recipe as Recipe | null | undefined;
  const dog = view?.dog;
  const today = useMemo(() => new Date().toLocaleDateString(), []);
  const canEdit =
    view?.approval?.status === 'pending' && !view.approval.tokenExpired && !submitted;

  // Per-dog suggested supplement doses (CHE-116). Pre-fills the editable dose
  // inputs so the vet just signs off — or types over — instead of computing
  // mg/lb × dog weight × food per day for every supplement.
  const dogWeightLbs = view?.dog?.weight_lbs ?? 0;
  const suggestions = useMemo(() => {
    if (!recipe) return [];
    return computeSuggestedDoses({ recipe, dogWeightLbs });
  }, [recipe, dogWeightLbs]);

  useEffect(() => {
    if (suggestions.length === 0) return;
    setDoses((prev) => {
      const next = { ...prev };
      for (const s of suggestions) {
        if (next[s.supplementName] === undefined) {
          next[s.supplementName] = s.suggestion ?? '';
        }
      }
      return next;
    });
  }, [suggestions]);

  const onSubmit = useCallback(async () => {
    if (!decision || !canEdit) return;
    setSubmitError(null);
    if (!vetName.trim()) {
      setSubmitError('Please enter your name.');
      return;
    }
    if (!signatureConfirmed) {
      setSubmitError('Please check the e-signature confirmation.');
      return;
    }
    if (decision === 'approve_with_notes' && !notes.trim()) {
      setSubmitError('Notes are required when approving with notes.');
      return;
    }
    setSubmitting(true);
    try {
      // Package the vet's per-supplement doses for an approval (skipped on
      // decline). Entries with no value (vet cleared the field) are filtered
      // out server-side too. (CHE-116)
      const supplementDoses = decision === 'decline'
        ? undefined
        : recipe?.supplements
            .map((s) => ({ supplementName: s.name, doseText: (doses[s.name] ?? '').trim() }))
            .filter((d) => d.doseText.length > 0);

      await submitVetApproval({
        token,
        decision,
        notes: notes.trim() || undefined,
        vetName: vetName.trim(),
        vetPractice: vetPractice.trim() || undefined,
        vetState: vetState.trim() || undefined,
        signatureConfirmed: true,
        supplementDoses,
      });
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [decision, canEdit, vetName, signatureConfirmed, notes, vetPractice, vetState, token, recipe, doses]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] text-[#78716C] text-sm">
        Loading approval request…
      </div>
    );
  }

  if (loadError || !view) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-[#2B2118]">We couldn't load this approval link.</h1>
          <p className="mt-2 text-sm text-[#78716C]">{loadError ?? 'Approval link not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFBF5] py-6 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#F97316]">Cheffo · Vet review</p>
          <h1 className="text-2xl font-bold text-[#2B2118]">
            {dog ? `Recipe review for ${dog.name}` : 'Recipe review'}
          </h1>
          <p className="text-sm text-[#78716C]">
            Approving takes about 60 seconds. Your decision sends back to the family right away.
          </p>
        </header>

        {(submitted || !canEdit) && view && <StatusBanner view={view} />}
        {submitted && (
          <div className="flex items-start gap-3 rounded-xl border border-[#BFE7CB] bg-[#E9F7EE] p-4 text-[#235D38]">
            <Check className="h-5 w-5 mt-0.5" />
            <p className="text-sm">Thanks, Dr. {vetName}. Your decision is recorded and the family has been notified.</p>
          </div>
        )}

        {dog && (
          <section className="rounded-2xl border border-[#EADFCE] bg-white p-4 space-y-2">
            <h2 className="font-semibold text-[#2B2118]">Patient</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-[#2B2118]">
              <div><dt className="text-xs uppercase text-[#9C7B52]">Name</dt><dd>{dog.name}</dd></div>
              <div><dt className="text-xs uppercase text-[#9C7B52]">Breed</dt><dd>{dog.breed}</dd></div>
              <div><dt className="text-xs uppercase text-[#9C7B52]">Weight</dt><dd>{dog.weight_lbs} lbs</dd></div>
              <div><dt className="text-xs uppercase text-[#9C7B52]">Age</dt><dd>{dog.age_years}y {dog.age_months}mo</dd></div>
              <div><dt className="text-xs uppercase text-[#9C7B52]">Life stage</dt><dd>{dog.life_stage}</dd></div>
              <div><dt className="text-xs uppercase text-[#9C7B52]">Activity</dt><dd>{dog.activity_level}</dd></div>
            </dl>
            {(dog.allergies?.length > 0 || dog.medications?.length > 0 || dog.avoid_foods?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs text-[#78716C]">
                <div><span className="font-semibold text-[#2B2118]">Allergies:</span> {dog.allergies?.length ? dog.allergies.join(', ') : 'None'}</div>
                <div><span className="font-semibold text-[#2B2118]">Medications:</span> {dog.medications?.length ? dog.medications.join(', ') : 'None'}</div>
                <div><span className="font-semibold text-[#2B2118]">Avoid:</span> {dog.avoid_foods?.length ? dog.avoid_foods.join(', ') : 'None'}</div>
              </div>
            )}
          </section>
        )}

        {recipe && (
          <section className="rounded-2xl border border-[#EADFCE] bg-white p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-[#2B2118]">{recipe.name}</h2>
              <p className="text-sm text-[#78716C]">{recipe.description}</p>
            </div>
            <NutritionCallout recipe={recipe} />
            <details className="text-sm" open>
              <summary className="cursor-pointer font-semibold text-[#2B2118]">Ingredients</summary>
              <ul className="mt-2 space-y-1 text-[#2B2118]">
                {recipe.ingredients.map(ingredient => (
                  <li key={ingredient.ingredientId} className="flex justify-between gap-2">
                    <span>{ingredient.name}</span>
                    <span className="text-[#78716C]">{Math.round(ingredient.amountGrams)} g</span>
                  </li>
                ))}
              </ul>
            </details>
            {recipe.supplements.length > 0 && (
              canEdit ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[#2B2118]">Supplements — your recommended doses</h3>
                    <p className="text-xs text-[#9C7B52] mt-0.5">
                      We pre-computed a suggested dose for {dog?.name ?? 'this dog'} based on weight and daily food. Accept it, edit it, or clear the field to skip.
                    </p>
                  </div>
                  {recipe.supplements.map((supplement) => {
                    const suggestion = suggestions.find((s) => s.supplementName === supplement.name);
                    return (
                      <div key={supplement.name} className="rounded-xl border border-[#EADFCE] bg-[#FFFBF5] p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#2B2118]">{supplement.name}</span>
                          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white border border-[#EADFCE] text-[#7C5018]">
                            {supplement.isRequired ? 'Required' : 'Optional'}
                          </span>
                        </div>
                        {supplement.estimatedAmount && (
                          <p className="text-xs text-[#78716C]">{supplement.estimatedAmount}</p>
                        )}
                        {suggestion?.suggestion && (
                          <p className="text-xs">
                            <span className="font-semibold text-[#2f7d4a]">Suggested for {dog?.name ?? 'this dog'}: </span>
                            <span className="text-[#2f7d4a]">{suggestion.suggestion}</span>
                            {suggestion.rationale && (
                              <span className="text-[#9C7B52]"> · {suggestion.rationale}</span>
                            )}
                          </p>
                        )}
                        <Input
                          label="Your recommended dose"
                          value={doses[supplement.name] ?? ''}
                          onChange={(event) =>
                            setDoses((prev) => ({ ...prev, [supplement.name]: event.target.value }))
                          }
                          placeholder={suggestion?.suggestion ?? 'Per product label'}
                          maxLength={200}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-[#2B2118]">Supplements</summary>
                  <ul className="mt-2 space-y-1 text-[#2B2118]">
                    {recipe.supplements.map((supplement) => (
                      <li key={supplement.name} className="flex justify-between gap-2">
                        <span>
                          {supplement.name} {supplement.isRequired ? '(required)' : '(optional)'}
                        </span>
                        <span className="text-[#78716C]">{supplement.estimatedAmount ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )
            )}
            {recipe.safetyNotes.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-[#2B2118]">Safety notes</summary>
                <ul className="mt-2 list-disc list-inside space-y-1 text-[#78716C]">
                  {recipe.safetyNotes.map(note => (<li key={note}>{note}</li>))}
                </ul>
              </details>
            )}
          </section>
        )}

        {canEdit && (
          <section className="rounded-2xl border border-[#EADFCE] bg-white p-4 space-y-4">
            <h2 className="font-semibold text-[#2B2118]">Your decision</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                fullWidth
                variant={decision === 'approve' ? 'success' : 'secondary'}
                icon={<Check className="h-4 w-4" />}
                onClick={() => setDecision('approve')}
              >
                Approve as-is
              </Button>
              <Button
                fullWidth
                variant={decision === 'approve_with_notes' ? 'primary' : 'secondary'}
                icon={<MessageSquareWarning className="h-4 w-4" />}
                onClick={() => setDecision('approve_with_notes')}
              >
                Approve with notes
              </Button>
              <Button
                fullWidth
                variant={decision === 'decline' ? 'danger' : 'secondary'}
                icon={<X className="h-4 w-4" />}
                onClick={() => setDecision('decline')}
              >
                Don't recommend
              </Button>
            </div>

            <Textarea
              label={decision === 'approve_with_notes' ? 'Notes (required)' : 'Optional notes'}
              hint={`${notes.length}/${MAX_NOTES}`}
              maxLength={MAX_NOTES}
              value={notes}
              onChange={event => setNotes(event.target.value.slice(0, MAX_NOTES))}
              placeholder="Anything you'd like the family to adjust, watch for, or discuss with you."
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Your name (DVM)" required value={vetName} onChange={event => setVetName(event.target.value)} />
              <Input label="Practice" value={vetPractice} onChange={event => setVetPractice(event.target.value)} />
              <Input label="State" value={vetState} onChange={event => setVetState(event.target.value)} placeholder="e.g. CA" />
            </div>

            <label className="flex gap-3 items-start text-sm text-[#2B2118]">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-[#F97316]"
                checked={signatureConfirmed}
                onChange={event => setSignatureConfirmed(event.target.checked)}
              />
              <span>
                I, Dr. {vetName.trim() || '_____'} DVM, confirm I reviewed this recipe for {dog?.name ?? 'this patient'} on {today}.
              </span>
            </label>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <Button
              fullWidth
              variant={decision === 'decline' ? 'danger' : 'primary'}
              size="lg"
              disabled={!decision}
              loading={submitting}
              onClick={onSubmit}
            >
              {decision === 'decline' ? 'Submit decision' : 'Submit approval'}
            </Button>

            <p className="text-xs text-[#9C7B52]">
              Cheffo does not provide veterinary advice. This decision reflects your professional judgment as the patient's treating veterinarian.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
