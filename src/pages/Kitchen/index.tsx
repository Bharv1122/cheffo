import { Suspense, lazy, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import KitchenDisplay from './KitchenDisplay';
import { DEMO_RECIPE_ID, useDemoKitchenRecipe, useSavedKitchenRecipe, type KitchenRecipeSource } from '../../kitchen/kitchenRecipe';

// three.js, @react-three/* and the XR runtime only load on the /xr route.
const KitchenXR = lazy(() => import('../../xr/KitchenXR'));

type Surface = 'display' | 'xr';

function Centered({ children }: { children: ReactNode }) {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-[#1C1917] p-6 text-center text-white">{children}</main>;
}

function Loading({ label }: { label: string }) {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-3 text-[#A8A29E]" role="status">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#574738] border-t-[#F97316]" />
        <p className="text-lg">{label}</p>
      </div>
    </Centered>
  );
}

function KitchenSurface({ source, surface, base }: { source: KitchenRecipeSource; surface: Surface; base: string }) {
  if (source.loading) return <Loading label="Loading recipe…" />;
  if (!source.recipe || !source.recipe.instructions.length) {
    return (
      <Centered>
        <div className="max-w-md rounded-3xl border border-[#3F3937] bg-[#262422] p-8">
          <h1 className="text-2xl font-semibold">{source.error ?? 'Recipe not found'}</h1>
          <p className="mt-2 text-[#A8A29E]">This recipe may have been deleted, or the link is from a different account.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/recipes" className="rounded-xl border border-[#3F3937] px-4 py-3 font-semibold">Your recipes</Link>
            <Link to={`/kitchen/${DEMO_RECIPE_ID}`} className="rounded-xl bg-[#F97316] px-4 py-3 font-semibold">Try the sample</Link>
          </div>
        </div>
      </Centered>
    );
  }
  const exitTo = source.isSample ? '/' : `/recipes/${source.recipe.id}`;
  if (surface === 'xr') {
    return (
      <Suspense fallback={<Loading label="Loading the 3D kitchen…" />}>
        <KitchenXR recipe={source.recipe} isSample={source.isSample} displayTo={base} exitTo={exitTo} />
      </Suspense>
    );
  }
  return <KitchenDisplay recipe={source.recipe} isSample={source.isSample} exitTo={exitTo} xrTo={`${base}/xr`} />;
}

export function KitchenDemoPage({ surface = 'display' }: { surface?: Surface }) {
  const source = useDemoKitchenRecipe();
  return <KitchenSurface source={source} surface={surface} base={`/kitchen/${DEMO_RECIPE_ID}`} />;
}

export function KitchenSavedPage({ surface = 'display' }: { surface?: Surface }) {
  const { recipeId } = useParams<{ recipeId: string }>();
  const source = useSavedKitchenRecipe(recipeId);
  return <KitchenSurface source={source} surface={surface} base={`/kitchen/${recipeId}`} />;
}
