import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn().mockResolvedValue(undefined);
const mockSendInvoices = vi.fn().mockResolvedValue(undefined);
const mockSendReceipts = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (args: unknown) => mockFindUnique(args as never) },
    userPreference: { upsert: (args: unknown) => mockUpsert(args as never) },
  },
}));

vi.mock("@/lib/email", () => ({
  sendNewDeductibleInvoicesEmail: (email: string) => mockSendInvoices(email),
  sendNewDeductibleReceiptsEmail: (email: string) => mockSendReceipts(email),
}));

describe("notifyPullCompletion", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpsert.mockClear();
    mockSendInvoices.mockClear();
    mockSendReceipts.mockClear();
  });

  it("sends comprobantes email + updates lastComprobantesNotifiedAt when count > 0 and not throttled", async () => {
    mockFindUnique.mockResolvedValue({
      email: "user@test.com",
      preference: {
        notifications: true,
        lastComprobantesNotifiedAt: null,
        lastRecibosNotifiedAt: null,
      },
    });

    const { notifyPullCompletion } = await import("@/lib/notifications/notify-pull-completion");
    await notifyPullCompletion("user-1", "comprobantes", 3);

    expect(mockSendInvoices).toHaveBeenCalledWith("user@test.com");
    expect(mockSendReceipts).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ userId: "user-1" });
    expect(call.update.lastComprobantesNotifiedAt).toBeInstanceOf(Date);
  });

  it("sends recibos email + updates lastRecibosNotifiedAt when kind = recibos", async () => {
    mockFindUnique.mockResolvedValue({
      email: "user@test.com",
      preference: {
        notifications: true,
        lastComprobantesNotifiedAt: null,
        lastRecibosNotifiedAt: null,
      },
    });

    const { notifyPullCompletion } = await import("@/lib/notifications/notify-pull-completion");
    await notifyPullCompletion("user-1", "recibos", 2);

    expect(mockSendReceipts).toHaveBeenCalledWith("user@test.com");
    expect(mockSendInvoices).not.toHaveBeenCalled();
    const call = mockUpsert.mock.calls[0][0];
    expect(call.update.lastRecibosNotifiedAt).toBeInstanceOf(Date);
  });

  it("does nothing when newDeducibleCount is zero", async () => {
    const { notifyPullCompletion } = await import("@/lib/notifications/notify-pull-completion");
    await notifyPullCompletion("user-1", "comprobantes", 0);

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockSendInvoices).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("skips the send when already notified today (same UTC day)", async () => {
    const earlierToday = new Date();
    mockFindUnique.mockResolvedValue({
      email: "user@test.com",
      preference: {
        notifications: true,
        lastComprobantesNotifiedAt: earlierToday,
        lastRecibosNotifiedAt: null,
      },
    });

    const { notifyPullCompletion } = await import("@/lib/notifications/notify-pull-completion");
    await notifyPullCompletion("user-1", "comprobantes", 5);

    expect(mockSendInvoices).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("skips when user has notifications=false on preference", async () => {
    mockFindUnique.mockResolvedValue({
      email: "user@test.com",
      preference: {
        notifications: false,
        lastComprobantesNotifiedAt: null,
        lastRecibosNotifiedAt: null,
      },
    });

    const { notifyPullCompletion } = await import("@/lib/notifications/notify-pull-completion");
    await notifyPullCompletion("user-1", "comprobantes", 5);

    expect(mockSendInvoices).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("skips when user has no email", async () => {
    mockFindUnique.mockResolvedValue({
      email: null,
      preference: {
        notifications: true,
        lastComprobantesNotifiedAt: null,
        lastRecibosNotifiedAt: null,
      },
    });

    const { notifyPullCompletion } = await import("@/lib/notifications/notify-pull-completion");
    await notifyPullCompletion("user-1", "comprobantes", 5);

    expect(mockSendInvoices).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("does not update the timestamp when the email send throws", async () => {
    mockFindUnique.mockResolvedValue({
      email: "user@test.com",
      preference: {
        notifications: true,
        lastComprobantesNotifiedAt: null,
        lastRecibosNotifiedAt: null,
      },
    });
    mockSendInvoices.mockRejectedValueOnce(new Error("Resend down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { notifyPullCompletion } = await import("@/lib/notifications/notify-pull-completion");
    await notifyPullCompletion("user-1", "comprobantes", 5);

    expect(mockSendInvoices).toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
