"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useFiscalYear } from "@/contexts/fiscal-year";

interface AttentionCountsShape {
  facturas: number;
  recibos: number;
  perfil: number;
}

interface PanelCountsState {
  attention: AttentionCountsShape;
  hasDomesticWorkers: boolean;
  hasEmployers: boolean;
  loading: boolean;
  invalidate: () => void;
}

const DEFAULT_STATE: PanelCountsState = {
  attention: { facturas: 0, recibos: 0, perfil: 0 },
  hasDomesticWorkers: true,
  hasEmployers: true,
  loading: true,
  invalidate: () => {},
};

const PanelCountsContext = createContext<PanelCountsState>(DEFAULT_STATE);

/**
 * Single consolidated provider that drives the three legacy count contexts.
 * One fetch to `/api/panel/counts` per fiscal year change replaces three
 * parallel fetches on mount.
 *
 * Sibling provider components (`AttentionCountsProvider`,
 * `DomesticWorkerCountProvider`, `EmployerCountProvider`) consume the same
 * state via legacy context shapes, so existing call sites work unchanged.
 */
export function PanelCountsProvider({ children }: { children: React.ReactNode }) {
  const { fiscalYear } = useFiscalYear();
  const [attention, setAttention] = useState<AttentionCountsShape>(DEFAULT_STATE.attention);
  const [hasDomesticWorkers, setHasDomesticWorkers] = useState(true);
  const [hasEmployers, setHasEmployers] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!fiscalYear) return;
    try {
      const res = await fetch(`/api/panel/counts?fiscalYear=${fiscalYear}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        attention: AttentionCountsShape;
        domesticWorkers: number;
        employers: number;
      };
      setAttention(data.attention);
      setHasDomesticWorkers(data.domesticWorkers > 0);
      setHasEmployers(data.employers > 0);
    } catch {
      // Silently fail — keep previous values
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    setLoading(true);
    fetchCounts();
  }, [fetchCounts]);

  const invalidate = useCallback(() => {
    fetchCounts();
  }, [fetchCounts]);

  const value = useMemo<PanelCountsState>(
    () => ({ attention, hasDomesticWorkers, hasEmployers, loading, invalidate }),
    [attention, hasDomesticWorkers, hasEmployers, loading, invalidate],
  );

  return <PanelCountsContext.Provider value={value}>{children}</PanelCountsContext.Provider>;
}

export function usePanelCounts() {
  return useContext(PanelCountsContext);
}
