"use client";

import { usePanelCounts } from "@/contexts/panel-counts";

interface EmployerCountContextType {
  hasEmployers: boolean;
  loading: boolean;
  invalidate: () => void;
}

/**
 * Legacy wrapper around the consolidated `PanelCountsProvider`.
 * Kept for backwards compatibility with existing call sites — new code
 * should consume `usePanelCounts()` directly.
 */
export function useEmployerCount(): EmployerCountContextType {
  const { hasEmployers, loading, invalidate } = usePanelCounts();
  return { hasEmployers, loading, invalidate };
}
