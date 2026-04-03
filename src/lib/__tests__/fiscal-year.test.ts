import { describe, it, expect } from "vitest";
import { isFiscalYearReadOnly, getAvailableFiscalYears } from "@/lib/fiscal-year";

describe("isFiscalYearReadOnly", () => {
  // Current year is never read-only
  it("returns false for the current year", () => {
    const now = new Date(2026, 5, 15); // June 2026
    expect(isFiscalYearReadOnly(2026, now)).toBe(false);
  });

  it("returns false for the current year in January", () => {
    const now = new Date(2026, 0, 15); // January 2026
    expect(isFiscalYearReadOnly(2026, now)).toBe(false);
  });

  // Previous year before cutoff (Jan–Mar) is writable
  it("returns false for previous year in January", () => {
    const now = new Date(2026, 0, 15); // January 2026
    expect(isFiscalYearReadOnly(2025, now)).toBe(false);
  });

  it("returns false for previous year in February", () => {
    const now = new Date(2026, 1, 15); // February 2026
    expect(isFiscalYearReadOnly(2025, now)).toBe(false);
  });

  it("returns false for previous year on March 31st", () => {
    const now = new Date(2026, 2, 31); // March 31, 2026
    expect(isFiscalYearReadOnly(2025, now)).toBe(false);
  });

  // Previous year after cutoff (Apr+) is read-only
  it("returns true for previous year on April 1st", () => {
    const now = new Date(2026, 3, 1); // April 1, 2026
    expect(isFiscalYearReadOnly(2025, now)).toBe(true);
  });

  it("returns true for previous year in December", () => {
    const now = new Date(2026, 11, 15); // December 2026
    expect(isFiscalYearReadOnly(2025, now)).toBe(true);
  });

  // Older years are always read-only
  it("returns true for year two years ago even in January", () => {
    const now = new Date(2026, 0, 15); // January 2026
    expect(isFiscalYearReadOnly(2024, now)).toBe(true);
  });

  it("returns true for year two years ago in March", () => {
    const now = new Date(2026, 2, 15); // March 2026
    expect(isFiscalYearReadOnly(2024, now)).toBe(true);
  });

  it("returns true for very old fiscal year", () => {
    const now = new Date(2026, 5, 15); // June 2026
    expect(isFiscalYearReadOnly(2020, now)).toBe(true);
  });

  // Future years are not read-only
  it("returns false for a future fiscal year", () => {
    const now = new Date(2026, 5, 15); // June 2026
    expect(isFiscalYearReadOnly(2027, now)).toBe(false);
  });

  // Edge case: uses current date when no date provided
  it("works without a date argument (uses current date)", () => {
    const currentYear = new Date().getFullYear();
    expect(isFiscalYearReadOnly(currentYear)).toBe(false);
  });
});

describe("getAvailableFiscalYears", () => {
  it("returns [previous, current] in January", () => {
    const now = new Date(2026, 0, 15); // January 2026
    expect(getAvailableFiscalYears(now)).toEqual([2025, 2026]);
  });

  it("returns [previous, current] in March", () => {
    const now = new Date(2026, 2, 31); // March 31, 2026
    expect(getAvailableFiscalYears(now)).toEqual([2025, 2026]);
  });

  it("returns [previous, current] in April (previous is read-only but still listed)", () => {
    const now = new Date(2026, 3, 1); // April 1, 2026
    expect(getAvailableFiscalYears(now)).toEqual([2025, 2026]);
  });

  it("returns [previous, current] in December", () => {
    const now = new Date(2026, 11, 15); // December 2026
    expect(getAvailableFiscalYears(now)).toEqual([2025, 2026]);
  });

  it("never includes the next year", () => {
    const now = new Date(2026, 5, 15); // June 2026
    const years = getAvailableFiscalYears(now);
    expect(years).not.toContain(2027);
  });

  it("works without a date argument", () => {
    const years = getAvailableFiscalYears();
    const currentYear = new Date().getFullYear();
    expect(years).toContain(currentYear);
    expect(years).not.toContain(currentYear + 1);
  });
});
