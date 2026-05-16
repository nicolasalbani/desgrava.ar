import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { isPrivateCacheHeader } from "@/lib/http/cache-headers";

const getServerSession = vi.fn();
const jobFindMany = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    automationJob: {
      findMany: (args: unknown) => jobFindMany(args as never),
    },
  },
}));

vi.mock("@/lib/queue/redis-queue", () => ({
  publishJob: vi.fn(),
}));

beforeEach(() => {
  getServerSession.mockReset();
  jobFindMany.mockReset();
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/automatizacion");
}

describe("GET /api/automatizacion Cache-Control", () => {
  it("emits no-store when an active job exists", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "u1" } });
    jobFindMany.mockResolvedValueOnce([
      { id: "j1", status: "RUNNING", jobType: "PULL_COMPROBANTES" },
    ]);

    const { GET } = await import("@/app/api/automatizacion/route");
    const res = await GET(makeRequest());

    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(isPrivateCacheHeader(res.headers.get("Cache-Control")!)).toBe(true);
  });

  it("emits a private SWR header when nothing is active", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "u1" } });
    jobFindMany.mockResolvedValueOnce([
      { id: "j1", status: "COMPLETED", jobType: "PULL_COMPROBANTES" },
    ]);

    const { GET } = await import("@/app/api/automatizacion/route");
    const res = await GET(makeRequest());

    const header = res.headers.get("Cache-Control")!;
    expect(header).toContain("private");
    expect(header).toMatch(/max-age=\d+/);
    expect(header).toMatch(/stale-while-revalidate=\d+/);
    expect(header).not.toContain("public");
    expect(isPrivateCacheHeader(header)).toBe(true);
  });

  it("never emits a 'public' directive — would let intermediate CDN cache per-user data", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "u1" } });
    jobFindMany.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/automatizacion/route");
    const res = await GET(makeRequest());

    expect(res.headers.get("Cache-Control")).not.toMatch(/\bpublic\b/);
  });

  it("queries with a 24h window so historical jobs don't bloat the payload", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "u1" } });
    jobFindMany.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/automatizacion/route");
    await GET(makeRequest());

    expect(jobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "u1",
          createdAt: { gte: expect.any(Date) },
        }),
      }),
    );

    const call = jobFindMany.mock.calls[0]![0] as { where: { createdAt: { gte: Date } } };
    const cutoff = call.where.createdAt.gte;
    const expected = Date.now() - 24 * 60 * 60 * 1000;
    expect(cutoff.getTime()).toBeGreaterThan(expected - 1000);
    expect(cutoff.getTime()).toBeLessThan(expected + 1000);
  });

  it("returns 401 when there is no session", async () => {
    getServerSession.mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/automatizacion/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });
});
