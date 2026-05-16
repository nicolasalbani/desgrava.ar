import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const MONTHLY_KEY = "MERCADOPAGO_PLAN_MONTHLY_INIT_POINT";
const ANNUAL_KEY = "MERCADOPAGO_PLAN_ANNUAL_INIT_POINT";

const createMock = vi.fn();

vi.mock("mercadopago", () => ({
  PreApproval: class {
    create = createMock;
  },
}));

vi.mock("@/lib/mercadopago/client", () => ({
  getMercadoPagoClient: vi.fn().mockReturnValue({}),
}));

describe("createPreapproval", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    original[MONTHLY_KEY] = process.env[MONTHLY_KEY];
    original[ANNUAL_KEY] = process.env[ANNUAL_KEY];
    createMock.mockReset();
  });

  afterEach(() => {
    process.env[MONTHLY_KEY] = original[MONTHLY_KEY];
    process.env[ANNUAL_KEY] = original[ANNUAL_KEY];
  });

  it("posts with preapproval_plan_id (from MONTHLY init_point) + external_reference, no payer_email", async () => {
    process.env[MONTHLY_KEY] =
      "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=plan_monthly_abc";
    createMock.mockResolvedValue({ id: "pre_123", init_point: "https://mp/init" });

    const { createPreapproval } = await import("@/lib/mercadopago/preapproval");
    const result = await createPreapproval("MONTHLY", "user_xyz");

    expect(createMock).toHaveBeenCalledWith({
      body: {
        preapproval_plan_id: "plan_monthly_abc",
        external_reference: "user_xyz",
      },
    });
    expect(result).toEqual({ id: "pre_123", init_point: "https://mp/init" });
  });

  it("uses the ANNUAL plan id when billingFrequency is ANNUAL", async () => {
    process.env[ANNUAL_KEY] =
      "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=plan_annual_xyz";
    createMock.mockResolvedValue({ id: "pre_456", init_point: "https://mp/init2" });

    const { createPreapproval } = await import("@/lib/mercadopago/preapproval");
    await createPreapproval("ANNUAL", "user_abc");

    expect(createMock).toHaveBeenCalledWith({
      body: {
        preapproval_plan_id: "plan_annual_xyz",
        external_reference: "user_abc",
      },
    });
  });

  it("never sends payer_email (so user can pay with any MP account)", async () => {
    process.env[MONTHLY_KEY] =
      "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=plan_monthly_abc";
    createMock.mockResolvedValue({ id: "pre_123", init_point: "https://mp/init" });

    const { createPreapproval } = await import("@/lib/mercadopago/preapproval");
    await createPreapproval("MONTHLY", "user_xyz");

    const body = createMock.mock.calls[0][0].body;
    expect(body).not.toHaveProperty("payer_email");
  });

  it("throws if the plan init_point env var is missing", async () => {
    delete process.env[MONTHLY_KEY];
    const { createPreapproval } = await import("@/lib/mercadopago/preapproval");
    await expect(createPreapproval("MONTHLY", "user_xyz")).rejects.toThrow(/not configured/);
  });

  it("throws if the init_point URL is missing the preapproval_plan_id query param", async () => {
    process.env[MONTHLY_KEY] = "https://www.mercadopago.com.ar/subscriptions/checkout";
    const { createPreapproval } = await import("@/lib/mercadopago/preapproval");
    await expect(createPreapproval("MONTHLY", "user_xyz")).rejects.toThrow(
      /missing preapproval_plan_id/,
    );
  });

  it("throws if MP response is missing id or init_point", async () => {
    process.env[MONTHLY_KEY] =
      "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=plan_monthly_abc";
    createMock.mockResolvedValue({});

    const { createPreapproval } = await import("@/lib/mercadopago/preapproval");
    await expect(createPreapproval("MONTHLY", "user_xyz")).rejects.toThrow(
      /missing id or init_point/,
    );
  });
});
