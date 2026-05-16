"use client";

import { usePanelCounts } from "@/contexts/panel-counts";

interface DomesticWorkerCountContextType {
  hasWorkers: boolean;
  loading: boolean;
  invalidate: () => void;
}

/**
 * Legacy wrapper around the consolidated `PanelCountsProvider`.
 * Kept for backwards compatibility with existing call sites — new code
 * should consume `usePanelCounts()` directly.
 */
export function useDomesticWorkerCount(): DomesticWorkerCountContextType {
  const { hasDomesticWorkers, loading, invalidate } = usePanelCounts();
  return { hasWorkers: hasDomesticWorkers, loading, invalidate };
}
