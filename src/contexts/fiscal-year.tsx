"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface FiscalYearContextType {
  fiscalYear: number | null;
  setFiscalYear: (year: number) => void;
  activeYears: number[];
}

const FiscalYearContext = createContext<FiscalYearContextType>({
  fiscalYear: null,
  setFiscalYear: () => {},
  activeYears: [],
});

export function FiscalYearProvider({ children }: { children: React.ReactNode }) {
  const [fiscalYear, setFiscalYearState] = useState<number | null>(null);
  const [activeYears, setActiveYears] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((res) => res.json())
      .then((data) => {
        const year = data.preference?.defaultFiscalYear;
        if (typeof year === "number") {
          setFiscalYearState(year);
        }
        if (Array.isArray(data.activeYears)) {
          setActiveYears(data.activeYears);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  function setFiscalYear(year: number) {
    setFiscalYearState(year);
    fetch("/api/configuracion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultFiscalYear: year }),
    });
  }

  if (!loaded) return null;

  return (
    <FiscalYearContext.Provider value={{ fiscalYear, setFiscalYear, activeYears }}>
      {children}
    </FiscalYearContext.Provider>
  );
}

export function useFiscalYear() {
  return useContext(FiscalYearContext);
}
