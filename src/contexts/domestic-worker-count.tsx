"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useFiscalYear } from "@/contexts/fiscal-year";

interface DomesticWorkerCountContextType {
  hasWorkers: boolean;
  loading: boolean;
  invalidate: () => void;
}

const DomesticWorkerCountContext = createContext<DomesticWorkerCountContextType>({
  hasWorkers: true,
  loading: true,
  invalidate: () => {},
});

export function DomesticWorkerCountProvider({ children }: { children: React.ReactNode }) {
  const { fiscalYear } = useFiscalYear();
  const [hasWorkers, setHasWorkers] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    if (!fiscalYear) return;
    try {
      const res = await fetch(`/api/trabajadores?fiscalYear=${fiscalYear}&count=true`);
      if (res.ok) {
        const data = await res.json();
        setHasWorkers(data.count > 0);
      }
    } catch {
      // Silently fail — default to showing the nav item
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    setLoading(true);
    fetchCount();
  }, [fetchCount]);

  const invalidate = useCallback(() => {
    fetchCount();
  }, [fetchCount]);

  return (
    <DomesticWorkerCountContext.Provider value={{ hasWorkers, loading, invalidate }}>
      {children}
    </DomesticWorkerCountContext.Provider>
  );
}

export function useDomesticWorkerCount() {
  return useContext(DomesticWorkerCountContext);
}
