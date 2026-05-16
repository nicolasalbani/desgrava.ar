import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { isPrivateCacheHeader } from "@/lib/http/cache-headers";

const getSession = vi.fn();
const workerCount = vi.fn();
const employerCount = vi.fn();
const getAttentionCounts = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSession(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    domesticWorker: { count: (args: unknown) => workerCount(args as never) },
    employer: { count: (args: unknown) => employerCount(args as never) },
  },
}));

vi.mock("@/lib/attention/counts", () => ({
  getAttentionCounts: (userId: string, fy?: number) => getAttentionCounts(userId, fy),
}));

beforeEach(() => {
  getSession.mockReset();
  workerCount.mockReset();
  employerCount.mockReset();
  getAttentionCounts.mockReset();
});

function makeRequest(url = "http://localhost/api/panel/counts"): NextRequest {
  return new NextRequest(url);
}

describe("GET /api/panel/counts", () => {
  it("returns the combined { attention, domesticWorkers, employers } shape", async () => {
    getSession.mockResolvedValueOnce({ user: { id: "u1" } });
    getAttentionCounts.mockResolvedValueOnce({ facturas: 3, recibos: 1, perfil: 0 });
    workerCount.mockResolvedValueOnce(2);
    employerCount.mockResolvedValueOnce(1);

    const { GET } = await import("@/app/api/panel/counts/route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body).toEqual({
      attention: { facturas: 3, recibos: 1, perfil: 0 },
      domesticWorkers: 2,
      employers: 1,
    });
  });

  it("emits a private Cache-Control header with SWR", async () => {
    getSession.mockResolvedValueOnce({ user: { id: "u1" } });
    getAttentionCounts.mockResolvedValueOnce({ facturas: 0, recibos: 0, perfil: 0 });
    workerCount.mockResolvedValueOnce(0);
    employerCount.mockResolvedValueOnce(0);

    const { GET } = await import("@/app/api/panel/counts/route");
    const res = await GET(makeRequest());

    const header = res.headers.get("Cache-Control")!;
    expect(header).toContain("private");
    expect(header).not.toContain("public");
    expect(header).toMatch(/max-age=\d+/);
    expect(header).toMatch(/stale-while-revalidate=\d+/);
    expect(isPrivateCacheHeader(header)).toBe(true);
  });

  it("forwards a fiscalYear param to the underlying queries", async () => {
    getSession.mockResolvedValueOnce({ user: { id: "u1" } });
    getAttentionCounts.mockResolvedValueOnce({ facturas: 0, recibos: 0, perfil: 0 });
    workerCount.mockResolvedValueOnce(0);
    employerCount.mockResolvedValueOnce(0);

    const { GET } = await import("@/app/api/panel/counts/route");
    await GET(makeRequest("http://localhost/api/panel/counts?fiscalYear=2026"));

    expect(getAttentionCounts).toHaveBeenCalledWith("u1", 2026);
    expect(workerCount).toHaveBeenCalledWith({
      where: { userId: "u1", fiscalYear: 2026 },
    });
    expect(employerCount).toHaveBeenCalledWith({
      where: { userId: "u1", fiscalYear: 2026 },
    });
  });

  it("returns 401 when there is no session", async () => {
    getSession.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/panel/counts/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });
});
