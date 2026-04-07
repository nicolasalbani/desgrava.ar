"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useFiscalYear } from "@/contexts/fiscal-year";

interface EmployerCountContextType {
  hasEmployers: boolean;
  loading: boolean;
  invalidate: () => void;
}

const EmployerCountContext = createContext<EmployerCountContextType>({
  hasEmployers: true,
  loading: true,
  invalidate: () => {},
});

export function EmployerCountProvider({ children }: { children: React.ReactNode }) {
  const { fiscalYear } = useFiscalYear();
  const [hasEmployers, setHasEmployers] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    if (!fiscalYear) return;
    try {
      const res = await fetch(`/api/empleadores?year=${fiscalYear}&count=true`);
      if (res.ok) {
        const data = await res.json();
        setHasEmployers(data.count > 0);
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
    <EmployerCountContext.Provider value={{ hasEmployers, loading, invalidate }}>
      {children}
    </EmployerCountContext.Provider>
  );
}

export function useEmployerCount() {
  return useContext(EmployerCountContext);
}
