import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type TokenRecord = { token: string; identifier: string; expires: Date } | null;

const mockFindUnique = vi.fn<() => Promise<TokenRecord>>();
const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    verificationToken: {
      findUnique: (args: unknown) => mockFindUnique(args as never),
      delete: (args: unknown) => mockDelete(args as never),
    },
    user: {
      update: (args: unknown) => mockUpdate(args as never),
    },
  },
}));

describe("verify-email route", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockDelete.mockClear();
    mockUpdate.mockClear();
    process.env.NEXTAUTH_URL = "https://desgrava.ar";
  });

  describe("GET (backward-compat for in-flight emails)", () => {
    it("redirects to /verify-email page without consuming the token — defeats SafeLinks pre-fetch", async () => {
      const { GET } = await import("../route");
      const req = new NextRequest("https://desgrava.ar/api/auth/verify-email?token=abc123");

      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://desgrava.ar/verify-email?token=abc123");
      // Critical: no DB reads or writes — a bot pre-fetch must not consume the token.
      expect(mockFindUnique).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("redirects to /verify-email page even without a token param", async () => {
      const { GET } = await import("../route");
      const req = new NextRequest("https://desgrava.ar/api/auth/verify-email");

      const res = await GET(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://desgrava.ar/verify-email");
    });
  });

  describe("POST (actual verification)", () => {
    it("verifies the user and deletes the token when the token is valid", async () => {
      mockFindUnique.mockResolvedValue({
        token: "abc123",
        identifier: "verify:user@example.com",
        expires: new Date(Date.now() + 60_000),
      });

      const { POST } = await import("../route");
      const req = new NextRequest("https://desgrava.ar/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token: "abc123" }),
      });

      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: "user@example.com" },
          data: expect.objectContaining({ emailVerified: expect.any(Date) }),
        }),
      );
      expect(mockDelete).toHaveBeenCalledWith({ where: { token: "abc123" } });
    });

    it("returns token_expired when the token does not exist (already consumed)", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { POST } = await import("../route");
      const req = new NextRequest("https://desgrava.ar/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token: "gone" }),
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "token_expired" });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns token_expired when the token is past expiry", async () => {
      mockFindUnique.mockResolvedValue({
        token: "old",
        identifier: "verify:user@example.com",
        expires: new Date(Date.now() - 60_000),
      });

      const { POST } = await import("../route");
      const req = new NextRequest("https://desgrava.ar/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token: "old" }),
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "token_expired" });
      expect(mockDelete).toHaveBeenCalledWith({ where: { token: "old" } });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("rejects tokens whose identifier is not a verification identifier (e.g. reset tokens)", async () => {
      mockFindUnique.mockResolvedValue({
        token: "reset-token",
        identifier: "reset:user@example.com",
        expires: new Date(Date.now() + 60_000),
      });

      const { POST } = await import("../route");
      const req = new NextRequest("https://desgrava.ar/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ token: "reset-token" }),
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "token_expired" });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns invalid_token when no token is provided", async () => {
      const { POST } = await import("../route");
      const req = new NextRequest("https://desgrava.ar/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_token" });
      expect(mockFindUnique).not.toHaveBeenCalled();
    });
  });
});
