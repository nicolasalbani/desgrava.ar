import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type UserRow = {
  id: string;
  subscription: {
    plan: "PERSONAL" | "FOUNDERS";
    status: "ACTIVE" | "TRIALING" | "CANCELLED" | "PAST_DUE" | "EXPIRED";
    trialEndDate: Date | null;
    currentPeriodEnd: Date | null;
  } | null;
  preference: { notifications: boolean } | null;
  arcaCredential: { isValidated: boolean } | null;
};

type ActiveJob = {
  userId: string;
  jobType: "PULL_COMPROBANTES" | "PULL_DOMESTIC_RECEIPTS";
};

type WorkerRow = { userId: string };

type CreateArgs = {
  data: {
    userId: string;
    jobType: string;
    fiscalYear: number;
    status: string;
    notifyOnComplete: boolean;
  };
};

const userFindMany = vi.fn<() => Promise<UserRow[]>>();
const jobFindMany = vi.fn<() => Promise<ActiveJob[]>>();
const workerFindMany = vi.fn<() => Promise<WorkerRow[]>>();
const jobCreate = vi.fn(async (args: CreateArgs) => ({
  id: `job-${args.data.userId}-${args.data.jobType}`,
}));

const publishJob = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: (args: unknown) => userFindMany(args as never) },
    automationJob: {
      findMany: (args: unknown) => jobFindMany(args as never),
      create: (args: unknown) => jobCreate(args as CreateArgs),
    },
    domesticWorker: { findMany: (args: unknown) => workerFindMany(args as never) },
  },
}));

vi.mock("@/lib/queue/redis-queue", () => ({
  publishJob: (id: string) => publishJob(id),
}));

function userWith(opts: {
  id: string;
  status?: UserRow["subscription"] extends infer S
    ? S extends null
      ? never
      : S extends { status: infer X }
        ? X
        : never
    : never;
  plan?: "PERSONAL" | "FOUNDERS";
  notifications?: boolean;
  validated?: boolean;
  noSubscription?: boolean;
  noCredential?: boolean;
  trialEndDate?: Date | null;
  currentPeriodEnd?: Date | null;
}): UserRow {
  return {
    id: opts.id,
    subscription: opts.noSubscription
      ? null
      : {
          plan: opts.plan ?? "PERSONAL",
          status: opts.status ?? "ACTIVE",
          trialEndDate: opts.trialEndDate ?? null,
          currentPeriodEnd: opts.currentPeriodEnd ?? new Date("2027-01-01T00:00:00Z"),
        },
    preference: { notifications: opts.notifications ?? true },
    arcaCredential: opts.noCredential ? null : { isValidated: opts.validated ?? true },
  };
}

function authedRequest(): NextRequest {
  const headers = new Headers({ "x-cron-secret": "test-secret" });
  return new NextRequest("https://app.desgrava.ar/api/cron/daily-pull", { headers });
}

describe("POST /api/cron/daily-pull", () => {
  beforeEach(() => {
    userFindMany.mockReset();
    jobFindMany.mockReset();
    workerFindMany.mockReset();
    jobCreate.mockClear();
    publishJob.mockClear();
    process.env.CRON_SECRET = "test-secret";
  });

  it("rejects requests without the cron secret", async () => {
    delete process.env.CRON_SECRET;
    const { POST } = await import("../route");
    const res = await POST(new NextRequest("https://app.desgrava.ar/api/cron/daily-pull"));
    expect(res.status).toBe(401);
  });

  it("enqueues a PULL_COMPROBANTES job for every eligible user", async () => {
    userFindMany.mockResolvedValue([userWith({ id: "u1" }), userWith({ id: "u2" })]);
    jobFindMany.mockResolvedValue([]);
    workerFindMany.mockResolvedValue([]);

    const { POST } = await import("../route");
    const res = await POST(authedRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      totalUsers: 2,
      comprobantesJobs: 2,
      recibosJobs: 0,
      skipped: 0,
    });
    expect(jobCreate).toHaveBeenCalledTimes(2);
    expect(publishJob).toHaveBeenCalledTimes(2);
    for (const call of jobCreate.mock.calls) {
      expect(call[0].data.notifyOnComplete).toBe(true);
      expect(call[0].data.jobType).toBe("PULL_COMPROBANTES");
    }
  });

  it("enqueues PULL_DOMESTIC_RECEIPTS only for users with a registered DomesticWorker", async () => {
    userFindMany.mockResolvedValue([userWith({ id: "u1" }), userWith({ id: "u2" })]);
    jobFindMany.mockResolvedValue([]);
    workerFindMany.mockResolvedValue([{ userId: "u1" }]);

    const { POST } = await import("../route");
    const res = await POST(authedRequest());
    const json = await res.json();

    expect(json).toMatchObject({
      totalUsers: 2,
      comprobantesJobs: 2,
      recibosJobs: 1,
      skipped: 0,
    });
    const recibosCalls = jobCreate.mock.calls.filter(
      (c) => c[0].data.jobType === "PULL_DOMESTIC_RECEIPTS",
    );
    expect(recibosCalls).toHaveLength(1);
    expect(recibosCalls[0][0].data.userId).toBe("u1");
  });

  it("excludes ineligible users (expired subscription)", async () => {
    userFindMany.mockResolvedValue([
      userWith({ id: "u1", status: "EXPIRED" }),
      userWith({ id: "u2" }),
    ]);
    jobFindMany.mockResolvedValue([]);
    workerFindMany.mockResolvedValue([]);

    const { POST } = await import("../route");
    const res = await POST(authedRequest());
    const json = await res.json();

    expect(json).toMatchObject({ totalUsers: 1, comprobantesJobs: 1 });
    expect(jobCreate).toHaveBeenCalledTimes(1);
    expect(jobCreate.mock.calls[0][0].data.userId).toBe("u2");
  });

  it("excludes users with missing or unvalidated ARCA credentials", async () => {
    userFindMany.mockResolvedValue([
      userWith({ id: "u1", noCredential: true }),
      userWith({ id: "u2", validated: false }),
      userWith({ id: "u3" }),
    ]);
    jobFindMany.mockResolvedValue([]);
    workerFindMany.mockResolvedValue([]);

    const { POST } = await import("../route");
    const res = await POST(authedRequest());
    const json = await res.json();

    expect(json).toMatchObject({ totalUsers: 1, comprobantesJobs: 1 });
    expect(jobCreate.mock.calls[0][0].data.userId).toBe("u3");
  });

  it("excludes users with notifications=false", async () => {
    userFindMany.mockResolvedValue([
      userWith({ id: "u1", notifications: false }),
      userWith({ id: "u2" }),
    ]);
    jobFindMany.mockResolvedValue([]);
    workerFindMany.mockResolvedValue([]);

    const { POST } = await import("../route");
    const res = await POST(authedRequest());
    const json = await res.json();

    expect(json).toMatchObject({ totalUsers: 1, comprobantesJobs: 1 });
    expect(jobCreate.mock.calls[0][0].data.userId).toBe("u2");
  });

  it("skips users with an in-flight job of the same type", async () => {
    userFindMany.mockResolvedValue([userWith({ id: "u1" }), userWith({ id: "u2" })]);
    jobFindMany.mockResolvedValue([{ userId: "u1", jobType: "PULL_COMPROBANTES" }]);
    workerFindMany.mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);

    const { POST } = await import("../route");
    const res = await POST(authedRequest());
    const json = await res.json();

    // u1 skips comprobantes (in-flight) but still gets recibos (no in-flight recibos)
    // u2 gets both
    expect(json).toMatchObject({
      totalUsers: 2,
      comprobantesJobs: 1,
      recibosJobs: 2,
      skipped: 1,
    });
  });

  it("returns zeros when there are no eligible users", async () => {
    userFindMany.mockResolvedValue([]);
    const { POST } = await import("../route");
    const res = await POST(authedRequest());
    const json = await res.json();

    expect(json).toMatchObject({
      totalUsers: 0,
      comprobantesJobs: 0,
      recibosJobs: 0,
      skipped: 0,
    });
    expect(jobCreate).not.toHaveBeenCalled();
    expect(publishJob).not.toHaveBeenCalled();
  });
});
