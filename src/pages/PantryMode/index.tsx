import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, X, AlertTriangle, ChefHat } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { PageWrapper } from '../../components/layout/PageWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { useRecipes } from '../../hooks/useRecipes';
import { useDogProfiles } from '../../hooks/useDogProfiles';
import { generateRecipe } from '../../utils/recipeGenerator';
import { checkSingleIngredient } from '../../utils/safetyValidator';
import { findIngredientByName } from '../../data/ingredients';

export default function PantryModePage() {
  const navigate = useNavigate();
  const { saveRecipe } = useRecipes();
  const { activeProfile } = useDogProfiles();

  const [input, setInput] = useState('');
  const [ingredients, setIngredients] = useState<Array<{ name: string; safe: boolean; warning?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function parseIngredientEntries(rawInput: string): string[] {
    return rawInput
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  function focusInputSoon() {
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function addIngredientFromInput(rawInput = input) {
    const parsedNames = parseIngredientEntries(rawInput);
    if (parsedNames.length === 0) {
      focusInputSoon();
      return;
    }

    const checkedEntries = parsedNames.map(name => ({ name, safety: checkSingleIngredient(name, activeProfile ?? undefined) }));
    const firstUnsafe = checkedEntries.find(entry => !entry.safety.safe);

    if (firstUnsafe) {
      setError(firstUnsafe.safety.errors.join(' '));
      focusInputSoon();
      return;
    }

    setIngredients(prev => [
      ...prev,
      ...checkedEntries.map(({ name, safety }) => ({
        name,
        safe: true,
        warning: safety.warnings[0],
      })),
    ]);
    setInput('');
    setError('');
    focusInputSoon();
  }

  function remove(name: string) {
    setIngredients(prev => prev.filter(i => i.name !== name));
  }

  async function handleGenerate() {
    if (!activeProfile) { setError('Please add a dog profile first.'); return; }
    if (ingredients.length === 0) { setError('Add at least one ingredient to your pantry.'); return; }

    const pantryIds = ingredients
      .map(i => findIngredientByName(i.name)?.id)
      .filter((id): id is string => !!id);

    setLoading(true);
    setError('');
    try {
      const recipe = await generateRecipe({
        dog: activeProfile,
        recipeType: 'pantry',
        preferredProteinIds: pantryIds.slice(0, 2),
        budgetMode: false,
        pantryIngredientIds: pantryIds,
      });
      const saved = await saveRecipe(recipe);
      navigate(`/recipes/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a recipe from those ingredients.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header title="Pantry Mode" backTo="/" />
      <PageWrapper>
        <div className="mb-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <ShoppingBag size={24} className="text-[#F97316]" />
          </div>
          <div>
            <h2 className="font-bold text-[#1C1917]">Use What You Have</h2>
            <p className="text-sm text-[#78716C] mt-0.5">Tell Cheffo Doggo what's in your fridge and pantry. Get a safe recipe idea using what you already have.</p>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-[#1C1917] text-sm mb-3">Your Pantry Ingredients</h3>
            <div className="flex gap-2 mb-3">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addIngredientFromInput(input);
                  }
                }}
                placeholder="e.g. chicken, carrots, sweet potato..."
                className="flex-1 rounded-xl border border-[#E7E5E4] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
              <Button icon={<Plus size={16} />} onClick={() => addIngredientFromInput(input)} size="md">Add</Button>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {ingredients.length === 0 ? (
              <p className="text-sm text-[#A8A29E] text-center py-6">Add ingredients to get started</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ingredients.map(ing => (
                  <span
                    key={ing.name}
                    className={['inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium', ing.warning ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'].join(' ')}
                  >
                    {ing.warning && <AlertTriangle size={12} />}
                    {ing.name}
                    <button type="button" onClick={() => remove(ing.name)} className="hover:opacity-70">
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {ingredients.some(i => i.warning) && (
              <div className="mt-3 space-y-1">
                {ingredients.filter(i => i.warning).map(i => (
                  <p key={i.name} className="text-xs text-amber-700 flex items-start gap-1">
                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                    {i.name}: {i.warning}
                  </p>
                ))}
              </div>
            )}
          </Card>

          <Disclaimer variant="info" title="How Pantry Mode Works">
            Cheffo Doggo will use your pantry ingredients to suggest a safe recipe or topper. If important nutritional components are missing (like calcium), you'll see a reminder. Pantry recipes may not be complete meals on their own.
          </Disclaimer>

          <Button
            fullWidth size="lg"
            icon={<ChefHat size={18} />}
            onClick={handleGenerate}
            loading={loading}
            disabled={ingredients.length === 0 || !activeProfile}
          >
            {loading ? 'Building recipe & image…' : 'Build a Recipe'}
          </Button>

          {!activeProfile && (
            <p className="text-xs text-center text-[#78716C]">
              <a href="/profiles/new" className="underline">Add a dog profile</a> to generate a recipe.
            </p>
          )}
        </div>
      </PageWrapper>
    </>
  );
}
