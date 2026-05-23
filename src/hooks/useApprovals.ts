// Loads every vet approval belonging to the signed-in user once and exposes
// helpers used by the recipe-listing tab, the Recipe Detail header badge, and
// the Home banner. RLS scopes the underlying query, so this is safe to use
// from any client surface. (CHE-124)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listAllUserApprovals, type ApprovalSummary } from '../lib/approvals';

const POSITIVE_STATUSES = new Set(['approved', 'approved_with_notes']);

export interface UseApprovalsResult {
  approvals: ApprovalSummary[];
  loading: boolean;
  error: string | null;
  // True when this recipe has at least one approved / approved_with_notes
  // approval — i.e. is "Vet Approved" in the badge sense.
  isApproved: (recipeId: string) => boolean;
  // Most-recent positive (approved/approved_with_notes) approval for a recipe,
  // or null. Drives the "Approved by Dr. X DVM" badge.
  primaryApprovalForRecipe: (recipeId: string) => ApprovalSummary | null;
  // Positive approvals submitted strictly after the given ISO timestamp. Used
  // by Home to show a banner for newly-arrived approvals since last-seen. A
  // null timestamp returns all of them.
  approvalsSince: (sinceIso: string | null) => ApprovalSummary[];
  refresh: () => Promise<void>;
}

export function useApprovals(): UseApprovalsResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [approvals, setApprovals] = useState<ApprovalSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!userId) {
      setApprovals([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listAllUserApprovals();
      if (!mountedRef.current) return;
      setApprovals(rows);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Could not load approvals.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Index by recipeId once per change.
  const byRecipeId = useMemo(() => {
    const map = new Map<string, ApprovalSummary[]>();
    for (const approval of approvals) {
      const list = map.get(approval.recipeId);
      if (list) list.push(approval);
      else map.set(approval.recipeId, [approval]);
    }
    return map;
  }, [approvals]);

  const isApproved = useCallback(
    (recipeId: string): boolean => {
      const list = byRecipeId.get(recipeId);
      if (!list) return false;
      return list.some((a) => POSITIVE_STATUSES.has(a.status));
    },
    [byRecipeId]
  );

  const primaryApprovalForRecipe = useCallback(
    (recipeId: string): ApprovalSummary | null => {
      const list = byRecipeId.get(recipeId);
      if (!list) return null;
      const positives = list.filter((a) => POSITIVE_STATUSES.has(a.status));
      if (positives.length === 0) return null;
      // Most recently submitted positive approval wins.
      return positives
        .slice()
        .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))[0];
    },
    [byRecipeId]
  );

  const approvalsSince = useCallback(
    (sinceIso: string | null): ApprovalSummary[] => {
      return approvals.filter((a) => {
        if (!POSITIVE_STATUSES.has(a.status)) return false;
        if (!a.submittedAt) return false;
        if (!sinceIso) return true;
        return a.submittedAt > sinceIso;
      });
    },
    [approvals]
  );

  return {
    approvals,
    loading,
    error,
    isApproved,
    primaryApprovalForRecipe,
    approvalsSince,
    refresh: load,
  };
}
