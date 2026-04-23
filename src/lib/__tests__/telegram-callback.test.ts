import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildCatalogCallbackData, parseCatalogCallbackData } from "@/lib/telegram-callback";

describe("telegram-callback", () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  it("builds a callback_data string within Telegram's 64-byte limit", () => {
    const data = buildCatalogCallbackData("approve", "30534357016");
    expect(data.length).toBeLessThanOrEqual(64);
    expect(data).toMatch(/^catalog:a:30534357016:[0-9a-f]{8}$/);
  });

  it("uses short action codes for approve and reject", () => {
    expect(buildCatalogCallbackData("approve", "30534357016")).toMatch(/^catalog:a:/);
    expect(buildCatalogCallbackData("reject", "30534357016")).toMatch(/^catalog:r:/);
  });

  it("round-trips approve action", () => {
    const data = buildCatalogCallbackData("approve", "30534357016");
    const parsed = parseCatalogCallbackData(data);
    expect(parsed).toEqual({ action: "approve", cuit: "30534357016" });
  });

  it("round-trips reject action", () => {
    const data = buildCatalogCallbackData("reject", "20123456789");
    const parsed = parseCatalogCallbackData(data);
    expect(parsed).toEqual({ action: "reject", cuit: "20123456789" });
  });

  it("rejects a callback_data with a tampered CUIT", () => {
    const data = buildCatalogCallbackData("approve", "30534357016");
    const tampered = data.replace("30534357016", "99999999999");
    expect(parseCatalogCallbackData(tampered)).toBeNull();
  });

  it("rejects a callback_data with a tampered action code", () => {
    const data = buildCatalogCallbackData("approve", "30534357016");
    const tampered = data.replace("catalog:a:", "catalog:r:");
    expect(parseCatalogCallbackData(tampered)).toBeNull();
  });

  it("rejects a callback_data signed with a different secret", () => {
    const data = buildCatalogCallbackData("approve", "30534357016");
    process.env.TELEGRAM_WEBHOOK_SECRET = "another-secret";
    expect(parseCatalogCallbackData(data)).toBeNull();
  });

  it("rejects malformed callback_data", () => {
    expect(parseCatalogCallbackData("random-string")).toBeNull();
    expect(parseCatalogCallbackData("catalog:a:30534357016")).toBeNull();
    expect(parseCatalogCallbackData("catalog:x:30534357016:abcd1234")).toBeNull();
    expect(parseCatalogCallbackData("other:a:30534357016:abcd1234")).toBeNull();
  });

  it("rejects callback_data when HMAC length is wrong", () => {
    expect(parseCatalogCallbackData("catalog:a:30534357016:abcd")).toBeNull();
  });

  it("throws when building callback_data without a configured secret", () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect(() => buildCatalogCallbackData("approve", "30534357016")).toThrow(
      "TELEGRAM_WEBHOOK_SECRET is not configured",
    );
  });

  it("returns null when parsing without a configured secret", () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect(parseCatalogCallbackData("catalog:a:30534357016:abcd1234")).toBeNull();
  });
});
