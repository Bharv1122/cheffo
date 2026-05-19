import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Copy, Mail, Printer } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Button } from '../../components/ui/Button';
import { useRecipes } from '../../hooks/useRecipes';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { formatRecipeType, formatCalories, formatDate, formatGrams, formatOz } from '../../utils/formatting';
import type { DogProfile } from '../../types/dog';
import type { Recipe } from '../../types/recipe';

function buildVetEmailTemplate(recipe: Recipe, dog: DogProfile | null): string {
  const dogSummary = dog
    ? `${dog.name}, ${dog.breed}, ${dog.ageYears}y ${dog.ageMonths}mo, ${dog.weightLbs} lbs, ${dog.lifeStage}, ${dog.activityLevel} activity`
    : 'Dog profile not attached';

  const ingredients = recipe.ingredients
    .map(ingredient => `- ${ingredient.name}: ${ingredient.amountGrams}g (${formatOz(ingredient.amountGrams)})`)
    .join('\n');
  const supplements = recipe.supplements.length
    ? recipe.supplements.map(supplement => `- ${supplement.name}: ${supplement.estimatedAmount ?? 'vet to advise'} (${supplement.isRequired ? 'required' : 'optional'})`).join('\n')
    : '- None listed';
  const safetyNotes = recipe.safetyNotes.length
    ? recipe.safetyNotes.map(note => `- ${note}`).join('\n')
    : '- No extra safety notes listed';

  return `Subject: Vet review requested for homemade dog food recipe — ${recipe.name}

Hi Dr. __________,

Could you please review this homemade dog food recipe and advise whether it is appropriate for my dog?

Dog profile:
${dogSummary}

Recipe:
${recipe.name}
Type: ${formatRecipeType(recipe.type)}
Description: ${recipe.description}

Ingredients:
${ingredients}

Estimated portion plan:
- Daily calories: ${formatCalories(recipe.nutrition.caloriesPerDay)}
- Per meal: ${formatGrams(recipe.serving.gramsPerMeal)} / ${recipe.serving.cupsPerMeal} cups
- Meals per day: ${recipe.serving.mealsPerDay}
- Total daily food: ${formatGrams(recipe.serving.totalDailyGrams)}

Supplements to review:
${supplements}

Safety notes:
${safetyNotes}

Questions:
1. Is this recipe appropriate for my dog's age, breed, weight, and health status?
2. Are any ingredients unsafe or worth limiting?
3. What supplements and exact doses do you recommend?
4. Should calories, portions, or feeding frequency be adjusted?
5. How should I transition my dog onto this recipe?

Thank you!`;
}

export default function VetExportPage() {
  const { id } = useParams<{ id: string }>();
  const { getRecipe } = useRecipes();
  const { getProfile } = useDogProfiles();
  const recipe = getRecipe(id!);
  const dog = recipe ? getProfile(recipe.dogProfileId) : null;
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  if (!recipe) {
    return (
      <>
        <Header title="Vet Export" backTo="/recipes" />
        <PageWrapper><p className="text-[#78716C] text-sm">Recipe not found.</p></PageWrapper>
      </>
    );
  }

  const ACTIVITY_LABELS: Record<string, string> = {
    low: 'Low', moderate: 'Moderate', active: 'Active', very_active: 'Very Active',
  };
  const vetEmailTemplate = buildVetEmailTemplate(recipe, dog ?? null);
  const emailSubject = `Vet review requested for homemade dog food recipe — ${recipe.name}`;
  const emailBody = vetEmailTemplate.replace(/^Subject: .+\n\n/, '');
  const mailtoHref = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  async function copyVetEmailTemplate() {
    try {
      await navigator.clipboard.writeText(vetEmailTemplate);
      setCopyStatus('copied');
      window.setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <>
      <Header
        title="Vet Review Export"
        backTo={`/recipes/${recipe.id}`}
        backLabel="Recipe"
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={<Copy size={15} />} onClick={() => void copyVetEmailTemplate()}>
              {copyStatus === 'copied' ? 'Copied' : 'Copy Email Template'}
            </Button>
            <a href={mailtoHref} className="inline-flex">
              <Button size="sm" variant="secondary" icon={<Mail size={15} />}>
                Email Vet
              </Button>
            </a>
            <Button size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>
              Print
            </Button>
          </div>
        }
      />
      <PageWrapper>
        {/* Print hint */}
        <div className="no-print mb-4 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
          This page is formatted for printing, saving as PDF, or emailing to your vet. Use Print for paper/PDF, Email Vet to open your email app, or Copy Email Template to paste into any message.
          {copyStatus === 'copied' && (
            <p className="mt-2 flex items-center gap-1 font-semibold text-green-700"><Check size={14} /> Email template copied.</p>
          )}
          {copyStatus === 'error' && (
            <p className="mt-2 font-semibold text-red-700">Could not copy automatically. Select and copy the template below.</p>
          )}
        </div>

        <section className="no-print mb-4 rounded-xl border border-[#E7E5E4] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-[#1C1917] text-lg">Veterinary Review Email Template</h2>
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => void copyVetEmailTemplate()}>
              {copyStatus === 'copied' ? 'Copied' : 'Copy Email Template'}
            </Button>
          </div>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[#FFFBF5] p-3 text-xs leading-relaxed text-[#3a302a]">{vetEmailTemplate}</pre>
        </section>

        <div className="space-y-6">
          {/* Header */}
          <div className="border-b border-[#E7E5E4] pb-4">
            <h1 className="text-2xl font-bold text-[#1C1917]">Homemade Dog Food Review — Cheffo Doggo</h1>
            <p className="text-sm text-[#78716C] mt-1">Prepared {formatDate(new Date().toISOString())} · For vet review</p>
          </div>

          {/* Dog profile */}
          {dog && (
            <section>
              <h2 className="font-bold text-[#1C1917] text-lg mb-3">🐾 Dog Profile</h2>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {[
                    ['Name', dog.name],
                    ['Breed', dog.breed],
                    ['Age', `${dog.ageYears}y ${dog.ageMonths}mo`],
                    ['Weight', `${dog.weightLbs} lbs`],
                    ['Ideal Weight', dog.idealWeightLbs ? `${dog.idealWeightLbs} lbs` : 'Not specified'],
                    ['Life Stage', dog.lifeStage],
                    ['Activity Level', ACTIVITY_LABELS[dog.activityLevel]],
                    ['Meals Per Day', String(dog.mealsPerDay)],
                    ['Allergies', dog.allergies.join(', ') || 'None listed'],
                    ['Foods to Avoid', dog.avoidFoods.join(', ') || 'None listed'],
                  ].map(([label, val]) => (
                    <tr key={label} className="border-b border-[#E7E5E4]">
                      <td className="py-2 pr-4 font-medium text-[#78716C] w-40">{label}</td>
                      <td className="py-2 text-[#1C1917]">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Recipe */}
          <section>
            <h2 className="font-bold text-[#1C1917] text-lg mb-3">🍲 Recipe: {recipe.name}</h2>
            <p className="text-sm text-[#78716C] mb-3">Type: {formatRecipeType(recipe.type)}</p>
            <p className="text-sm text-[#1C1917] mb-4">{recipe.description}</p>

            <h3 className="font-semibold text-[#1C1917] mb-2">Ingredients</h3>
            <table className="w-full text-sm border-collapse border border-[#E7E5E4]">
              <thead>
                <tr className="bg-[#FDF6E9]">
                  <th className="text-left p-2 border border-[#E7E5E4]">Ingredient</th>
                  <th className="text-left p-2 border border-[#E7E5E4]">Category</th>
                  <th className="text-right p-2 border border-[#E7E5E4]">Amount (g)</th>
                  <th className="text-right p-2 border border-[#E7E5E4]">Amount (oz)</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map(ing => (
                  <tr key={ing.ingredientId} className="border-b border-[#E7E5E4]">
                    <td className="p-2 border border-[#E7E5E4]">{ing.name}</td>
                    <td className="p-2 border border-[#E7E5E4] capitalize">{ing.category}</td>
                    <td className="p-2 border border-[#E7E5E4] text-right">{ing.amountGrams}g</td>
                    <td className="p-2 border border-[#E7E5E4] text-right">{formatOz(ing.amountGrams)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Portion plan */}
          <section>
            <h2 className="font-bold text-[#1C1917] text-lg mb-3">📊 Estimated Portion Plan</h2>
            <div className="text-sm space-y-1 text-[#1C1917]">
              <p><strong>Daily calorie estimate:</strong> {formatCalories(recipe.nutrition.caloriesPerDay)} (estimate)</p>
              <p><strong>Per meal:</strong> {formatGrams(recipe.serving.gramsPerMeal)} · {recipe.serving.cupsPerMeal} cups</p>
              <p><strong>Meals per day:</strong> {recipe.serving.mealsPerDay}</p>
              <p><strong>Total daily food:</strong> {formatGrams(recipe.serving.totalDailyGrams)}</p>
            </div>
          </section>

          {/* Supplement checklist */}
          {recipe.supplements.length > 0 && (
            <section>
              <h2 className="font-bold text-[#1C1917] text-lg mb-3">💊 Supplement Checklist (Educational Estimates)</h2>
              <p className="text-xs text-amber-700 italic mb-3">The following are educational starting points only. Please confirm all supplements, types, and dosing with this dog's veterinarian before use.</p>
              <table className="w-full text-sm border-collapse border border-[#E7E5E4]">
                <thead>
                  <tr className="bg-[#FDF6E9]">
                    <th className="text-left p-2 border border-[#E7E5E4]">Supplement</th>
                    <th className="text-left p-2 border border-[#E7E5E4]">Required?</th>
                    <th className="text-left p-2 border border-[#E7E5E4]">Estimated Range</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe.supplements.map(s => (
                    <tr key={s.name} className="border-b border-[#E7E5E4]">
                      <td className="p-2 border border-[#E7E5E4]">{s.name}</td>
                      <td className="p-2 border border-[#E7E5E4]">{s.isRequired ? 'Yes' : 'Optional'}</td>
                      <td className="p-2 border border-[#E7E5E4] text-xs text-[#78716C] italic">{s.estimatedAmount ?? 'See vet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Questions for vet */}
          <section>
            <h2 className="font-bold text-[#1C1917] text-lg mb-3">📝 Questions / Notes for Vet</h2>
            <div className="space-y-2">
              {[
                'Is this recipe nutritionally appropriate for my dog\'s age, breed, and health status?',
                'What supplement types and doses do you recommend for this recipe?',
                'Should the calorie or portion estimates be adjusted?',
                'Are there any ingredients I should remove or limit given my dog\'s health?',
                'How should I transition my dog to this diet?',
                '', '', '',
              ].map((q, i) => (
                <div key={i} className="border-b border-[#E7E5E4] pb-2">
                  <p className="text-sm text-[#78716C] italic">{q}</p>
                  <div className="mt-1 h-6 border-b border-dashed border-[#E7E5E4]" />
                </div>
              ))}
            </div>
          </section>

          {/* Veterinarian Review & Sign-off */}
          <section className="border-2 border-[#0f766e] rounded-lg p-4 bg-[#f0fdfa] page-break-before">
            <h2 className="font-bold text-[#0f766e] text-lg mb-3">✍️ Veterinarian Review &amp; Approval</h2>
            <p className="text-xs text-[#0f766e] mb-4">For the reviewing veterinarian to complete and sign.</p>

            <div className="space-y-2 mb-4">
              {[
                'Approved as proposed',
                'Approved with modifications (see notes below)',
                'Not recommended at this time',
              ].map(label => (
                <div key={label} className="flex items-center gap-2 text-sm text-[#1C1917]">
                  <span className="inline-block w-4 h-4 border-2 border-[#0f766e] rounded-sm" />
                  {label}
                </div>
              ))}
            </div>

            <p className="text-sm font-semibold text-[#1C1917] mb-1">Notes / Modifications:</p>
            <div className="h-24 border border-[#9ca3af] rounded bg-white mb-4"
                 style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 22px, #e5e7eb 22px, #e5e7eb 23px)' }} />

            <div className="grid grid-cols-3 gap-4 text-xs text-[#78716C]">
              <div><div className="border-b border-[#374151] h-7" /><div className="mt-1">Veterinarian Signature</div></div>
              <div><div className="border-b border-[#374151] h-7" /><div className="mt-1">Printed Name</div></div>
              <div><div className="border-b border-[#374151] h-7" /><div className="mt-1">Date</div></div>
              <div><div className="border-b border-[#374151] h-7" /><div className="mt-1">Clinic Name</div></div>
              <div><div className="border-b border-[#374151] h-7" /><div className="mt-1">License #</div></div>
              <div><div className="border-b border-[#374151] h-7" /><div className="mt-1">Phone / Email</div></div>
            </div>
          </section>

          {/* Disclaimer */}
          <section className="border-t border-[#E7E5E4] pt-4">
            <p className="text-xs text-[#78716C] leading-relaxed italic">
              This document was generated by Cheffo Doggo (chef-doggo.vercel.app), a homemade dog food planning tool. Cheffo Doggo provides general educational guidance and does not replace professional veterinary advice. All calorie estimates, portion sizes, and supplement ranges are educational starting points only. A licensed veterinarian or veterinary nutritionist should review all homemade diets before feeding, especially for puppies, seniors, pregnant/nursing dogs, and dogs with medical conditions.
            </p>
          </section>
        </div>
      </PageWrapper>
    </>
  );
}
