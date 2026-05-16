import { describe, it, expect } from "vitest";
import {
  buildSubscriptionMutation,
  mapMPBillingFrequency,
  mapMPStatus,
} from "@/lib/mercadopago/webhooks";

describe("mapMPStatus", () => {
  it("maps authorized → ACTIVE", () => {
    expect(mapMPStatus("authorized")).toBe("ACTIVE");
  });

  it("maps paused and pending → PAST_DUE", () => {
    expect(mapMPStatus("paused")).toBe("PAST_DUE");
    expect(mapMPStatus("pending")).toBe("PAST_DUE");
  });

  it("maps cancelled → CANCELLED", () => {
    expect(mapMPStatus("cancelled")).toBe("CANCELLED");
  });

  it("returns null for unknown statuses", () => {
    expect(mapMPStatus("anything-else")).toBeNull();
  });
});

describe("mapMPBillingFrequency", () => {
  it("returns ANNUAL for 12 months", () => {
    expect(mapMPBillingFrequency(12)).toBe("ANNUAL");
  });

  it("returns MONTHLY for 1 month", () => {
    expect(mapMPBillingFrequency(1)).toBe("MONTHLY");
  });

  it("returns MONTHLY when frequency is undefined", () => {
    expect(mapMPBillingFrequency(undefined)).toBe("MONTHLY");
  });
});

describe("buildSubscriptionMutation", () => {
  const now = new Date("2026-05-15T12:00:00Z");

  it("returns ACTIVE with period dates for an authorized monthly preapproval", () => {
    const result = buildSubscriptionMutation(
      {
        status: "authorized",
        external_reference: "user_123",
        next_payment_date: "2026-06-15T12:00:00Z",
        frequencyMonths: 1,
      },
      "preapproval_abc",
      now,
    );
    expect(result).toEqual({
      status: "ACTIVE",
      billingFrequency: "MONTHLY",
      mercadoPagoPreapprovalId: "preapproval_abc",
      currentPeriodStart: now,
      currentPeriodEnd: new Date("2026-06-15T12:00:00Z"),
    });
  });

  it("returns ACTIVE without currentPeriodEnd when MP does not provide next_payment_date", () => {
    const result = buildSubscriptionMutation(
      {
        status: "authorized",
        external_reference: "user_123",
        next_payment_date: null,
        frequencyMonths: 12,
      },
      "preapproval_abc",
      now,
    );
    expect(result?.billingFrequency).toBe("ANNUAL");
    expect(result?.currentPeriodStart).toEqual(now);
    expect(result?.currentPeriodEnd).toBeUndefined();
  });

  it("returns CANCELLED with cancelledAt and no period start", () => {
    const result = buildSubscriptionMutation(
      {
        status: "cancelled",
        external_reference: "user_123",
        next_payment_date: null,
        frequencyMonths: 1,
      },
      "preapproval_abc",
      now,
    );
    expect(result?.status).toBe("CANCELLED");
    expect(result?.cancelledAt).toEqual(now);
    expect(result?.currentPeriodStart).toBeUndefined();
  });

  it("returns PAST_DUE without period or cancelled fields", () => {
    const result = buildSubscriptionMutation(
      {
        status: "paused",
        external_reference: "user_123",
        next_payment_date: null,
        frequencyMonths: 1,
      },
      "preapproval_abc",
      now,
    );
    expect(result?.status).toBe("PAST_DUE");
    expect(result?.currentPeriodStart).toBeUndefined();
    expect(result?.cancelledAt).toBeUndefined();
  });

  it("returns null when MP status does not map to a known state", () => {
    const result = buildSubscriptionMutation(
      {
        status: "unknown",
        external_reference: "user_123",
        next_payment_date: null,
        frequencyMonths: 1,
      },
      "preapproval_abc",
      now,
    );
    expect(result).toBeNull();
  });
});
