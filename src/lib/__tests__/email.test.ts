import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Resend before importing the module
const mockSend = vi.fn().mockResolvedValue({ id: "mock-id" });
vi.mock("resend", () => {
  class MockResend {
    emails = { send: mockSend };
  }
  return { Resend: MockResend };
});

describe("sendBugFixPREmail", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSend.mockClear();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.SUPPORT_EMAIL = "dev@desgrava.ar";
  });

  it("should send email to SUPPORT_EMAIL with ticket details and PR link", async () => {
    const { sendBugFixPREmail } = await import("@/lib/email");

    await sendBugFixPREmail(
      "Login button broken",
      "ticket-123",
      "https://github.com/org/repo/pull/42",
      "Root cause: missing null check in auth handler",
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe("dev@desgrava.ar");
    expect(call.subject).toContain("Login button broken");
    expect(call.html).toContain("ticket-123");
    expect(call.html).toContain("https://github.com/org/repo/pull/42");
    expect(call.html).toContain("missing null check in auth handler");
  });

  it("should not send email when SUPPORT_EMAIL is not set", async () => {
    delete process.env.SUPPORT_EMAIL;
    const { sendBugFixPREmail } = await import("@/lib/email");

    await sendBugFixPREmail(
      "Login button broken",
      "ticket-123",
      "https://github.com/org/repo/pull/42",
      "Fix summary",
    );

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should convert newlines to <br> in fix summary", async () => {
    const { sendBugFixPREmail } = await import("@/lib/email");

    await sendBugFixPREmail(
      "Test ticket",
      "ticket-456",
      "https://github.com/org/repo/pull/99",
      "Line 1\nLine 2\nLine 3",
    );

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain("Line 1<br>Line 2<br>Line 3");
  });

  it("should include a link to the PR in the email", async () => {
    const { sendBugFixPREmail } = await import("@/lib/email");
    const prUrl = "https://github.com/org/repo/pull/42";

    await sendBugFixPREmail("Test", "ticket-789", prUrl, "Summary");

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain(`href="${prUrl}"`);
    expect(call.html).toContain("Ver Pull Request");
  });
});
