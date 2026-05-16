import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Resend before importing the module
const mockSend = vi.fn().mockResolvedValue({ id: "mock-id" });
vi.mock("resend", () => {
  class MockResend {
    emails = { send: mockSend };
  }
  return { Resend: MockResend };
});

describe("sendNewDeductibleInvoicesEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockClear();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEXTAUTH_URL = "https://app.desgrava.ar";
  });

  it("sends the generic email to the given user with the correct subject", async () => {
    const { sendNewDeductibleInvoicesEmail } = await import("@/lib/email");

    await sendNewDeductibleInvoicesEmail("user@test.com");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe("user@test.com");
    expect(call.subject).toBe("Tenés nuevos comprobantes disponibles para desgravar");
  });

  it("includes a CTA link to the facturas page using NEXTAUTH_URL", async () => {
    const { sendNewDeductibleInvoicesEmail } = await import("@/lib/email");

    await sendNewDeductibleInvoicesEmail("user@test.com");

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain("https://app.desgrava.ar/comprobantes");
    expect(call.html).toContain("Ver mis comprobantes");
  });

  it("does not include per-user specifics in the body", async () => {
    const { sendNewDeductibleInvoicesEmail } = await import("@/lib/email");

    await sendNewDeductibleInvoicesEmail("user@test.com");

    const call = mockSend.mock.calls[0][0];
    expect(call.html).not.toContain("user@test.com");
    expect(call.html).not.toMatch(/CUIT|cuit/);
    expect(call.html).not.toMatch(/\$\d/);
  });

  it("falls back to localhost when NEXTAUTH_URL is not configured", async () => {
    delete process.env.NEXTAUTH_URL;
    const { sendNewDeductibleInvoicesEmail } = await import("@/lib/email");

    await sendNewDeductibleInvoicesEmail("user@test.com");

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain("http://localhost:3000/comprobantes");
  });
});

describe("sendNewDeductibleReceiptsEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockClear();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.NEXTAUTH_URL = "https://app.desgrava.ar";
  });

  it("sends the generic email to the given user with the recibos subject", async () => {
    const { sendNewDeductibleReceiptsEmail } = await import("@/lib/email");

    await sendNewDeductibleReceiptsEmail("user@test.com");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe("user@test.com");
    expect(call.subject).toBe("Tenés nuevos recibos disponibles para desgravar");
  });

  it("includes a CTA link to the recibos page using NEXTAUTH_URL", async () => {
    const { sendNewDeductibleReceiptsEmail } = await import("@/lib/email");

    await sendNewDeductibleReceiptsEmail("user@test.com");

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain("https://app.desgrava.ar/recibos");
    expect(call.html).toContain("Ver mis recibos");
  });

  it("does not include per-user specifics in the body", async () => {
    const { sendNewDeductibleReceiptsEmail } = await import("@/lib/email");

    await sendNewDeductibleReceiptsEmail("user@test.com");

    const call = mockSend.mock.calls[0][0];
    expect(call.html).not.toContain("user@test.com");
    expect(call.html).not.toMatch(/CUIT|cuit/);
    expect(call.html).not.toMatch(/\$\d/);
  });

  it("falls back to localhost when NEXTAUTH_URL is not configured", async () => {
    delete process.env.NEXTAUTH_URL;
    const { sendNewDeductibleReceiptsEmail } = await import("@/lib/email");

    await sendNewDeductibleReceiptsEmail("user@test.com");

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain("http://localhost:3000/recibos");
  });
});
