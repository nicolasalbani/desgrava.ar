import { describe, it, expect } from "vitest";
import { resolveCanWrite } from "@/lib/subscription/access";

describe("resolveCanWrite", () => {
  const now = new Date("2026-03-15T12:00:00Z");

  describe("FOUNDERS plan", () => {
    it("always grants write access regardless of status", () => {
      expect(
        resolveCanWrite("FOUNDERS", "ACTIVE", now, {
          trialEndDate: null,
          currentPeriodEnd: null,
        }),
      ).toBe(true);
    });

    it("grants access even with EXPIRED status", () => {
      expect(
        resolveCanWrite("FOUNDERS", "EXPIRED", now, {
          trialEndDate: null,
          currentPeriodEnd: null,
        }),
      ).toBe(true);
    });

    it("grants access even with PAST_DUE status", () => {
      expect(
        resolveCanWrite("FOUNDERS", "PAST_DUE", now, {
          trialEndDate: null,
          currentPeriodEnd: null,
        }),
      ).toBe(true);
    });
  });

  describe("PERSONAL plan — ACTIVE status", () => {
    it("grants write access", () => {
      expect(
        resolveCanWrite("PERSONAL", "ACTIVE", now, {
          trialEndDate: null,
          currentPeriodEnd: new Date("2026-04-15"),
        }),
      ).toBe(true);
    });
  });

  describe("PERSONAL plan — TRIALING status", () => {
    it("grants access when trial has not expired", () => {
      const trialEnd = new Date("2026-04-14T00:00:00Z"); // future
      expect(
        resolveCanWrite("PERSONAL", "TRIALING", now, {
          trialEndDate: trialEnd,
          currentPeriodEnd: null,
        }),
      ).toBe(true);
    });

    it("denies access when trial has expired", () => {
      const trialEnd = new Date("2026-03-10T00:00:00Z"); // past
      expect(
        resolveCanWrite("PERSONAL", "TRIALING", now, {
          trialEndDate: trialEnd,
          currentPeriodEnd: null,
        }),
      ).toBe(false);
    });

    it("denies access when trial end date is exactly now", () => {
      expect(
        resolveCanWrite("PERSONAL", "TRIALING", now, {
          trialEndDate: now,
          currentPeriodEnd: null,
        }),
      ).toBe(false);
    });

    it("denies access when trial end date is null", () => {
      expect(
        resolveCanWrite("PERSONAL", "TRIALING", now, {
          trialEndDate: null,
          currentPeriodEnd: null,
        }),
      ).toBe(false);
    });
  });

  describe("PERSONAL plan — CANCELLED status", () => {
    it("grants access within current billing period", () => {
      const periodEnd = new Date("2026-04-01T00:00:00Z"); // future
      expect(
        resolveCanWrite("PERSONAL", "CANCELLED", now, {
          trialEndDate: null,
          currentPeriodEnd: periodEnd,
        }),
      ).toBe(true);
    });

    it("denies access after current billing period", () => {
      const periodEnd = new Date("2026-03-01T00:00:00Z"); // past
      expect(
        resolveCanWrite("PERSONAL", "CANCELLED", now, {
          trialEndDate: null,
          currentPeriodEnd: periodEnd,
        }),
      ).toBe(false);
    });

    it("denies access when period end is exactly now", () => {
      expect(
        resolveCanWrite("PERSONAL", "CANCELLED", now, {
          trialEndDate: null,
          currentPeriodEnd: now,
        }),
      ).toBe(false);
    });

    it("denies access when currentPeriodEnd is null", () => {
      expect(
        resolveCanWrite("PERSONAL", "CANCELLED", now, {
          trialEndDate: null,
          currentPeriodEnd: null,
        }),
      ).toBe(false);
    });
  });

  describe("PERSONAL plan — PAST_DUE status", () => {
    it("denies write access", () => {
      expect(
        resolveCanWrite("PERSONAL", "PAST_DUE", now, {
          trialEndDate: null,
          currentPeriodEnd: new Date("2026-04-15"),
        }),
      ).toBe(false);
    });
  });

  describe("PERSONAL plan — EXPIRED status", () => {
    it("denies write access", () => {
      expect(
        resolveCanWrite("PERSONAL", "EXPIRED", now, {
          trialEndDate: null,
          currentPeriodEnd: null,
        }),
      ).toBe(false);
    });
  });
});
