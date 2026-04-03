/**
 * After March 31st each year, the previous fiscal year is no longer accessible
 * in SiRADIG. When a fiscal year is read-only, all automation actions (import,
 * export, submit) should be disabled.
 */
export function isFiscalYearReadOnly(fiscalYear: number, now: Date = new Date()): boolean {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  // Current year is never read-only
  if (fiscalYear >= currentYear) return false;

  // Previous year is writable only Jan–Mar (months 1–3)
  if (fiscalYear === currentYear - 1 && currentMonth <= 3) return false;

  // All other past years are read-only
  return true;
}

/**
 * Returns the fiscal years available in SiRADIG.
 * - Jan–Mar: [previousYear, currentYear] (both accessible)
 * - Apr–Dec: [currentYear] (only current year accessible)
 *
 * Past read-only years are always included for historical viewing.
 */
export function getAvailableFiscalYears(now: Date = new Date()): number[] {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (currentMonth <= 3) {
    return [currentYear - 1, currentYear];
  }
  return [currentYear - 1, currentYear];
}
