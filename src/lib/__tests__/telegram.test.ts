import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { escapeMarkdownV2 } from "@/lib/telegram";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("escapeMarkdownV2", () => {
  it("should escape all MarkdownV2 special characters", () => {
    const input =
      "hello_world*bold[link](url)~strike`code>quote#plus+minus-equal=pipe|brace{end}.dot!bang\\slash";
    const result = escapeMarkdownV2(input);
    expect(result).toBe(
      "hello\\_world\\*bold\\[link\\]\\(url\\)\\~strike\\`code\\>quote\\#plus\\+minus\\-equal\\=pipe\\|brace\\{end\\}\\.dot\\!bang\\\\slash",
    );
  });

  it("should return plain text unchanged", () => {
    expect(escapeMarkdownV2("hello world 123")).toBe("hello world 123");
  });

  it("should handle empty string", () => {
    expect(escapeMarkdownV2("")).toBe("");
  });

  it("should escape email addresses", () => {
    expect(escapeMarkdownV2("user@example.com")).toBe("user@example\\.com");
  });
});

describe("sendNewUserNotification", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "-100123456";
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("should send a formatted message with user email and auth method", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { sendNewUserNotification } = await import("@/lib/telegram");

    await sendNewUserNotification("user@test.com", "Google");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    const body = JSON.parse(options.body);
    expect(body.chat_id).toBe("-100123456");
    expect(body.parse_mode).toBe("MarkdownV2");
    expect(body.text).toContain("Nuevo usuario");
    expect(body.text).toContain("user@test\\.com");
    expect(body.text).toContain("Google");
  });

  it("should send notification for email/password signups", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { sendNewUserNotification } = await import("@/lib/telegram");

    await sendNewUserNotification("user@test.com", "Email/Contraseña");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain("Email/Contraseña");
  });

  it("should silently skip when TELEGRAM_BOT_TOKEN is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const { sendNewUserNotification } = await import("@/lib/telegram");

    await sendNewUserNotification("user@test.com", "Google");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should silently skip when TELEGRAM_CHAT_ID is missing", async () => {
    delete process.env.TELEGRAM_CHAT_ID;
    const { sendNewUserNotification } = await import("@/lib/telegram");

    await sendNewUserNotification("user@test.com", "Google");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should throw on Telegram API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request: chat not found"),
    });
    const { sendNewUserNotification } = await import("@/lib/telegram");

    await expect(sendNewUserNotification("user@test.com", "Google")).rejects.toThrow(
      "Telegram API error 400",
    );
  });
});

describe("sendNewTicketNotification", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "-100123456";
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("should send a formatted message with all ticket fields", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { sendNewTicketNotification } = await import("@/lib/telegram");

    await sendNewTicketNotification(
      "ticket-abc",
      "Login broken",
      "I can't log in with Google",
      "user@test.com",
      "/dashboard",
      "job-xyz",
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain("Nuevo ticket de soporte");
    expect(body.text).toContain("ticket\\-abc");
    expect(body.text).toContain("Login broken");
    expect(body.text).toContain("user@test\\.com");
    expect(body.text).toContain("/dashboard");
    expect(body.text).toContain("job\\-xyz");
  });

  it("should omit page URL and job ID when null", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { sendNewTicketNotification } = await import("@/lib/telegram");

    await sendNewTicketNotification(
      "ticket-abc",
      "General question",
      "How do I use the simulator?",
      "user@test.com",
      null,
      null,
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).not.toContain("Página:");
    expect(body.text).not.toContain("Job:");
  });

  it("should truncate description to 500 characters", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const { sendNewTicketNotification } = await import("@/lib/telegram");

    const longDescription = "A".repeat(600);
    await sendNewTicketNotification(
      "ticket-abc",
      "Long ticket",
      longDescription,
      "user@test.com",
      null,
      null,
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // 500 A's + the "…" character (escaped as needed)
    expect(body.text).not.toContain("A".repeat(501));
  });

  it("should silently skip when env vars are missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    const { sendNewTicketNotification } = await import("@/lib/telegram");

    await sendNewTicketNotification(
      "ticket-abc",
      "Test",
      "Description",
      "user@test.com",
      null,
      null,
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("sendCatalogReviewProposal", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "-100123456";
    process.env.TELEGRAM_WEBHOOK_SECRET = "hmac-secret";
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  it("sends a message with proposal details and inline keyboard, and returns the message_id", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 777 } }),
    });
    const { sendCatalogReviewProposal } = await import("@/lib/telegram");

    const result = await sendCatalogReviewProposal({
      cuit: "30534357016",
      razonSocial: "CLINICA SALUD SA",
      proposedCategory: "GASTOS_MEDICOS",
      invoiceCount: 12,
      userCount: 7,
      activityDescription: "SERVICIOS DE ATENCIÓN MÉDICA",
    });

    expect(result).toBe(777);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    const body = JSON.parse(options.body);
    expect(body.chat_id).toBe("-100123456");
    expect(body.parse_mode).toBe("MarkdownV2");
    expect(body.text).toContain("Revisión de CUIT no deducible");
    expect(body.text).toContain("30534357016");
    expect(body.text).toContain("CLINICA SALUD SA");
    expect(body.text).toContain("GASTOS\\_MEDICOS");
    expect(body.text).toContain("12");
    expect(body.text).toContain("7");
    expect(body.reply_markup.inline_keyboard).toHaveLength(1);
    expect(body.reply_markup.inline_keyboard[0]).toHaveLength(2);
    const [approveBtn, rejectBtn] = body.reply_markup.inline_keyboard[0];
    expect(approveBtn.text).toContain("Aprobar");
    expect(approveBtn.callback_data).toMatch(/^catalog:a:30534357016:[0-9a-f]{8}$/);
    expect(rejectBtn.text).toContain("Rechazar");
    expect(rejectBtn.callback_data).toMatch(/^catalog:r:30534357016:[0-9a-f]{8}$/);
  });

  it("omits razón social and activity lines when null", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 1 } }),
    });
    const { sendCatalogReviewProposal } = await import("@/lib/telegram");

    await sendCatalogReviewProposal({
      cuit: "30534357016",
      razonSocial: null,
      proposedCategory: "OTRAS_DEDUCCIONES",
      invoiceCount: 1,
      userCount: 1,
      activityDescription: null,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).not.toContain("Razón social");
  });

  it("returns null and skips when env vars are missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const { sendCatalogReviewProposal } = await import("@/lib/telegram");

    const result = await sendCatalogReviewProposal({
      cuit: "30534357016",
      razonSocial: null,
      proposedCategory: "GASTOS_MEDICOS",
      invoiceCount: 1,
      userCount: 1,
      activityDescription: null,
    });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("editCatalogReviewMessage", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "-100123456";
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("clears the inline keyboard and sends a reply with the resolution", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("") });
    const { editCatalogReviewMessage } = await import("@/lib/telegram");

    await editCatalogReviewMessage(999, "✅ Aprobado por nicolas → GASTOS_MEDICOS");

    expect(mockFetch).toHaveBeenCalledTimes(2);

    const firstCall = mockFetch.mock.calls[0];
    expect(firstCall[0]).toContain("editMessageReplyMarkup");
    const firstBody = JSON.parse(firstCall[1].body);
    expect(firstBody.message_id).toBe(999);
    expect(firstBody.reply_markup.inline_keyboard).toEqual([]);

    const secondCall = mockFetch.mock.calls[1];
    expect(secondCall[0]).toContain("sendMessage");
    const secondBody = JSON.parse(secondCall[1].body);
    expect(secondBody.reply_to_message_id).toBe(999);
    expect(secondBody.text).toContain("Aprobado por nicolas");
  });

  it("silently skips when env vars are missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const { editCatalogReviewMessage } = await import("@/lib/telegram");

    await editCatalogReviewMessage(999, "resolution");

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
