import { useFiscalYear } from "@/contexts/fiscal-year";
import { isFiscalYearReadOnly } from "@/lib/fiscal-year";

/**
 * Returns true when the currently selected fiscal year is read-only
 * (past the March 31st SiRADIG cutoff).
 */
export function useFiscalYearReadOnly(): boolean {
  const { fiscalYear } = useFiscalYear();
  if (fiscalYear === null) return false;
  return isFiscalYearReadOnly(fiscalYear);
}
