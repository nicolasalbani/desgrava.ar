"use client";

import { usePanelCounts } from "@/contexts/panel-counts";

interface AttentionCountsContextType {
  facturas: number;
  recibos: number;
  perfil: number;
  /** Call after a local mutation that changes attention state */
  invalidate: () => void;
}

/**
 * Legacy wrapper around the consolidated `PanelCountsProvider`.
 * Kept for backwards compatibility with existing call sites — new code
 * should consume `usePanelCounts()` directly.
 */
export function useAttentionCounts(): AttentionCountsContextType {
  const { attention, invalidate } = usePanelCounts();
  return { ...attention, invalidate };
}
