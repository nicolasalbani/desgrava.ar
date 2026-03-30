import { describe, it, expect } from "vitest";
import {
  SUBSCRIPTION_PLANS,
  TRIAL_DURATION_DAYS,
  getAnnualTotal,
  getAnnualDiscountPercent,
  formatPriceARS,
} from "@/lib/subscription/plans";

describe("subscription plans", () => {
  describe("SUBSCRIPTION_PLANS", () => {
    it("defines a Personal plan with correct prices", () => {
      const personal = SUBSCRIPTION_PLANS.PERSONAL;
      expect(personal.name).toBe("Personal");
      expect(personal.monthlyPrice).toBe(5999);
      expect(personal.annualMonthlyPrice).toBe(4999);
    });

    it("Personal plan has features list", () => {
      expect(SUBSCRIPTION_PLANS.PERSONAL.features.length).toBeGreaterThan(0);
    });
  });

  describe("TRIAL_DURATION_DAYS", () => {
    it("is 30 days", () => {
      expect(TRIAL_DURATION_DAYS).toBe(30);
    });
  });

  describe("getAnnualTotal", () => {
    it("returns annualMonthlyPrice × 12", () => {
      expect(getAnnualTotal()).toBe(4999 * 12);
    });
  });

  describe("getAnnualDiscountPercent", () => {
    it("returns the correct discount percentage", () => {
      const percent = getAnnualDiscountPercent();
      // (1 - 4999/5999) * 100 ≈ 17%
      expect(percent).toBe(17);
    });

    it("returns an integer", () => {
      expect(Number.isInteger(getAnnualDiscountPercent())).toBe(true);
    });
  });

  describe("formatPriceARS", () => {
    it("formats price in ARS", () => {
      const formatted = formatPriceARS(5999);
      // Should contain the number — exact format depends on locale
      expect(formatted).toContain("5");
      expect(formatted).toContain("999");
    });

    it("formats zero", () => {
      const formatted = formatPriceARS(0);
      expect(formatted).toContain("0");
    });
  });
});
