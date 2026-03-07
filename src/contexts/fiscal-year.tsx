"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface FiscalYearContextType {
  fiscalYear: number | null;
  setFiscalYear: (year: number) => void;
}

const FiscalYearContext = createContext<FiscalYearContextType>({
  fiscalYear: null,
  setFiscalYear: () => {},
});

export function FiscalYearProvider({ children }: { children: React.ReactNode }) {
  const [fiscalYear, setFiscalYearState] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/configuracion")
      .then((res) => res.json())
      .then((data) => {
        const year = data.preference?.defaultFiscalYear;
        if (typeof year === "number") {
          setFiscalYearState(year);
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
    <FiscalYearContext.Provider value={{ fiscalYear, setFiscalYear }}>
      {children}
    </FiscalYearContext.Provider>
  );
}

export function useFiscalYear() {
  return useContext(FiscalYearContext);
}
