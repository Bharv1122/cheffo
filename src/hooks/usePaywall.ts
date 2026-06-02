// Paywall gating hook + premium-feature check helper. (CHE-36)
//
// Decision per the M4 tier strategy: free users get a single treat recipe as a
// "taste". Anything else (full meal, batch, topper, pantry mode, Ask Cheffo
// Doggo, Vet Export) is premium-only. The 14-day money-back guarantee replaces
// a traditional free trial — see project_chef_doggo_strategy.md.
//
// Usage:
//   const { canUseFeature, requireUpgrade } = usePaywall();
//   if (!canUseFeature('full_meal')) {
//     requireUpgrade('full_meal');  // opens the upgrade modal
//     return;
//   }

import { useCallback, useMemo, useState } from 'react';
import { useSubscription } from './useSubscription';
import { useRecipes } from './useRecipes';

export type PaywallFeature =
  | 'full_meal'
  | 'batch_week'
  | 'topper'
  | 'pantry'
  | 'treat'
  | 'assistant'
  | 'vet_export';

const FREE_TREAT_LIMIT = 1;

export interface UpgradePromptState {
  open: boolean;
  feature: PaywallFeature | null;
}

export interface UsePaywallResult {
  isPremium: boolean;
  // True while subscription state is still loading. Callers must NOT block or
  // open the upgrade modal while this is true — `isPremium` is false until the
  // subscription row resolves, so a premium user would otherwise be treated as
  // free on their first action after page load.
  isLoading: boolean;
  // True if the user can use this feature right now. Free users get
  // FREE_TREAT_LIMIT treat recipes lifetime; everything else is premium-only.
  canUseFeature: (feature: PaywallFeature) => boolean;
  // Open the upgrade modal for a feature. Useful for "premium" click handlers.
  requireUpgrade: (feature: PaywallFeature) => void;
  // For UpgradeModal to subscribe to.
  upgradePrompt: UpgradePromptState;
  dismissUpgradePrompt: () => void;
  // How many free treat recipes the user has left (0 once they've used theirs).
  treatRecipesRemaining: number;
}

export function usePaywall(): UsePaywallResult {
  const { isPremium, loading: isLoading } = useSubscription();
  const { recipes } = useRecipes();
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePromptState>({ open: false, feature: null });

  const treatRecipesUsed = useMemo(
    () => recipes.filter(r => r.type === 'treat').length,
    [recipes]
  );
  const treatRecipesRemaining = Math.max(0, FREE_TREAT_LIMIT - treatRecipesUsed);

  const canUseFeature = useCallback(
    (feature: PaywallFeature): boolean => {
      if (isPremium) return true;
      if (feature === 'treat') return treatRecipesRemaining > 0;
      return false;
    },
    [isPremium, treatRecipesRemaining]
  );

  const requireUpgrade = useCallback((feature: PaywallFeature) => {
    setUpgradePrompt({ open: true, feature });
  }, []);

  const dismissUpgradePrompt = useCallback(() => {
    setUpgradePrompt({ open: false, feature: null });
  }, []);

  return {
    isPremium,
    isLoading,
    canUseFeature,
    requireUpgrade,
    upgradePrompt,
    dismissUpgradePrompt,
    treatRecipesRemaining,
  };
}
