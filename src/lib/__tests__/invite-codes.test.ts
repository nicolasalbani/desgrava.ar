import { describe, it, expect, beforeEach, vi } from "vitest";
import { createInviteToken, validateInviteToken, INVITE_CODES } from "@/lib/invite-codes";

const TEST_SECRET = "test-nextauth-secret-for-unit-tests";

describe("invite-codes", () => {
  beforeEach(() => {
    vi.stubEnv("NEXTAUTH_SECRET", TEST_SECRET);
    vi.useRealTimers();
  });

  describe("INVITE_CODES", () => {
    it("exports a non-empty array of codes", () => {
      expect(INVITE_CODES).toBeInstanceOf(Array);
      expect(INVITE_CODES.length).toBeGreaterThan(0);
    });

    it("contains BETA2026", () => {
      expect(INVITE_CODES).toContain("BETA2026");
    });
  });

  describe("createInviteToken", () => {
    it("returns a string with payload.signature format", () => {
      const token = createInviteToken("BETA2026");
      const parts = token.split(".");
      expect(parts).toHaveLength(2);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it("payload is valid base64url-encoded JSON with code and ts", () => {
      const token = createInviteToken("BETA2026");
      const payload = token.split(".")[0];
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
      expect(decoded).toHaveProperty("code", "BETA2026");
      expect(decoded).toHaveProperty("ts");
      expect(typeof decoded.ts).toBe("number");
    });

    it("signature is a 64-char hex string (sha256)", () => {
      const token = createInviteToken("BETA2026");
      const sig = token.split(".")[1];
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("validateInviteToken", () => {
    it("returns true for a freshly created token", () => {
      const token = createInviteToken("BETA2026");
      expect(validateInviteToken(token)).toBe(true);
    });

    it("returns true for different invite codes", () => {
      const token = createInviteToken("SOME_OTHER_CODE");
      expect(validateInviteToken(token)).toBe(true);
    });

    it("returns false when the payload is tampered", () => {
      const token = createInviteToken("BETA2026");
      const [payload, sig] = token.split(".");
      // Modify the payload
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
      decoded.code = "TAMPERED";
      const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
      expect(validateInviteToken(`${tamperedPayload}.${sig}`)).toBe(false);
    });

    it("returns false when the signature is tampered", () => {
      const token = createInviteToken("BETA2026");
      const [payload] = token.split(".");
      const fakeSig = "a".repeat(64);
      expect(validateInviteToken(`${payload}.${fakeSig}`)).toBe(false);
    });

    it("returns false for a token with no dot separator", () => {
      expect(validateInviteToken("notokenhere")).toBe(false);
    });

    it("returns false for an empty string", () => {
      expect(validateInviteToken("")).toBe(false);
    });

    it("returns false for garbage input", () => {
      expect(validateInviteToken("abc.def.ghi")).toBe(false);
    });

    it("returns false when signed with a different secret", () => {
      const token = createInviteToken("BETA2026");
      vi.stubEnv("NEXTAUTH_SECRET", "completely-different-secret");
      expect(validateInviteToken(token)).toBe(false);
    });

    it("returns false for an expired token (older than 15 minutes)", () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const token = createInviteToken("BETA2026");

      // Advance time by 16 minutes
      vi.setSystemTime(now + 16 * 60 * 1000);
      expect(validateInviteToken(token)).toBe(false);

      vi.useRealTimers();
    });

    it("returns true for a token just within the 15-minute window", () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const token = createInviteToken("BETA2026");

      // Advance time by 14 minutes 59 seconds
      vi.setSystemTime(now + 14 * 60 * 1000 + 59 * 1000);
      expect(validateInviteToken(token)).toBe(true);

      vi.useRealTimers();
    });
  });
});
