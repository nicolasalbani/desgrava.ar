import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCheckoutUrl } from "@/lib/mercadopago/preapproval";

const MONTHLY_KEY = "MERCADOPAGO_PLAN_MONTHLY_INIT_POINT";
const ANNUAL_KEY = "MERCADOPAGO_PLAN_ANNUAL_INIT_POINT";

describe("getCheckoutUrl", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    original[MONTHLY_KEY] = process.env[MONTHLY_KEY];
    original[ANNUAL_KEY] = process.env[ANNUAL_KEY];
  });

  afterEach(() => {
    process.env[MONTHLY_KEY] = original[MONTHLY_KEY];
    process.env[ANNUAL_KEY] = original[ANNUAL_KEY];
  });

  it("appends external_reference to the monthly plan init_point", () => {
    process.env[MONTHLY_KEY] =
      "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=abc";
    const url = getCheckoutUrl("MONTHLY", "user_123");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("preapproval_plan_id")).toBe("abc");
    expect(parsed.searchParams.get("external_reference")).toBe("user_123");
  });

  it("uses the annual init_point for ANNUAL", () => {
    process.env[ANNUAL_KEY] =
      "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=annual_xyz";
    const url = getCheckoutUrl("ANNUAL", "user_456");
    expect(url).toContain("preapproval_plan_id=annual_xyz");
    expect(url).toContain("external_reference=user_456");
  });

  it("throws if the plan init_point env var is missing", () => {
    delete process.env[MONTHLY_KEY];
    expect(() => getCheckoutUrl("MONTHLY", "user_123")).toThrow(/not configured/);
  });

  it("overrides external_reference if the plan URL already had one", () => {
    process.env[MONTHLY_KEY] =
      "https://www.mercadopago.com.ar/checkout?preapproval_plan_id=x&external_reference=old";
    const url = getCheckoutUrl("MONTHLY", "user_new");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("external_reference")).toBe("user_new");
  });
});
