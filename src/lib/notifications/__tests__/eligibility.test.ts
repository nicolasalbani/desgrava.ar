import { describe, it, expect } from "vitest";
import {
  isEligibleForDailyPull,
  shouldSendNotificationToday,
} from "@/lib/notifications/eligibility";

const NOW = new Date("2026-05-11T10:00:00Z");

function baseInput() {
  return {
    subscription: {
      plan: "PERSONAL" as const,
      status: "ACTIVE" as const,
      trialEndDate: null,
      currentPeriodEnd: new Date("2027-05-11T00:00:00Z"),
    },
    preference: { notifications: true },
    credential: { isValidated: true },
    now: NOW,
  };
}

describe("isEligibleForDailyPull", () => {
  it("returns true for an ACTIVE PERSONAL subscriber with validated creds + notifications on", () => {
    expect(isEligibleForDailyPull(baseInput())).toBe(true);
  });

  it("returns true for a FOUNDERS user regardless of status", () => {
    const input = baseInput();
    input.subscription.plan = "FOUNDERS";
    input.subscription.status = "EXPIRED";
    input.subscription.currentPeriodEnd = null;
    expect(isEligibleForDailyPull(input)).toBe(true);
  });

  it("returns true for TRIALING within trialEndDate", () => {
    const input = baseInput();
    input.subscription.status = "TRIALING";
    input.subscription.trialEndDate = new Date("2026-06-01T00:00:00Z");
    expect(isEligibleForDailyPull(input)).toBe(true);
  });

  it("returns false for TRIALING past trialEndDate", () => {
    const input = baseInput();
    input.subscription.status = "TRIALING";
    input.subscription.trialEndDate = new Date("2026-05-01T00:00:00Z");
    expect(isEligibleForDailyPull(input)).toBe(false);
  });

  it("returns true for CANCELLED within currentPeriodEnd", () => {
    const input = baseInput();
    input.subscription.status = "CANCELLED";
    input.subscription.currentPeriodEnd = new Date("2026-06-01T00:00:00Z");
    expect(isEligibleForDailyPull(input)).toBe(true);
  });

  it("returns false for CANCELLED past currentPeriodEnd", () => {
    const input = baseInput();
    input.subscription.status = "CANCELLED";
    input.subscription.currentPeriodEnd = new Date("2026-05-01T00:00:00Z");
    expect(isEligibleForDailyPull(input)).toBe(false);
  });

  it("returns false for EXPIRED", () => {
    const input = baseInput();
    input.subscription.status = "EXPIRED";
    expect(isEligibleForDailyPull(input)).toBe(false);
  });

  it("returns false for PAST_DUE", () => {
    const input = baseInput();
    input.subscription.status = "PAST_DUE";
    expect(isEligibleForDailyPull(input)).toBe(false);
  });

  it("returns false when subscription is missing", () => {
    const input = { ...baseInput(), subscription: null };
    expect(isEligibleForDailyPull(input)).toBe(false);
  });

  it("returns false when credential is missing", () => {
    const input = { ...baseInput(), credential: null };
    expect(isEligibleForDailyPull(input)).toBe(false);
  });

  it("returns false when credential is not validated", () => {
    const input = { ...baseInput(), credential: { isValidated: false } };
    expect(isEligibleForDailyPull(input)).toBe(false);
  });

  it("returns false when notifications=false on preference", () => {
    const input = { ...baseInput(), preference: { notifications: false } };
    expect(isEligibleForDailyPull(input)).toBe(false);
  });

  it("returns true when preference is missing (defaults to notifications=true behavior)", () => {
    const input = { ...baseInput(), preference: null };
    expect(isEligibleForDailyPull(input)).toBe(true);
  });
});

describe("shouldSendNotificationToday", () => {
  it("returns true when lastNotifiedAt is null", () => {
    expect(shouldSendNotificationToday(null, NOW)).toBe(true);
  });

  it("returns false when lastNotifiedAt is earlier today (UTC)", () => {
    const earlierToday = new Date("2026-05-11T00:30:00Z");
    expect(shouldSendNotificationToday(earlierToday, NOW)).toBe(false);
  });

  it("returns false when lastNotifiedAt equals start of today (UTC)", () => {
    const startOfToday = new Date("2026-05-11T00:00:00Z");
    expect(shouldSendNotificationToday(startOfToday, NOW)).toBe(false);
  });

  it("returns true when lastNotifiedAt was the previous UTC day", () => {
    const yesterday = new Date("2026-05-10T23:59:59Z");
    expect(shouldSendNotificationToday(yesterday, NOW)).toBe(true);
  });

  it("returns true when lastNotifiedAt was long ago", () => {
    const longAgo = new Date("2025-01-01T00:00:00Z");
    expect(shouldSendNotificationToday(longAgo, NOW)).toBe(true);
  });
});
