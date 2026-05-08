import { describe, it, expect } from "vitest";
import {
  computeJobPercent,
  computeProgressSnapshot,
  getJobTypeLabel,
  JOB_TYPE_LABELS,
  type JobLite,
} from "@/lib/onboarding/progress-stages";
import { JOB_STEP_DURATIONS } from "@/lib/automation/job-steps";

function job(
  jobType: string,
  status: JobLite["status"],
  currentStep: string | null = null,
  currentStepStartedAt: Date | null = null,
): JobLite {
  return { jobType, status, currentStep, currentStepStartedAt };
}

const FIXED_NOW = new Date("2026-05-01T12:00:00Z").getTime();

describe("computeProgressSnapshot", () => {
  it("returns done with 0% when no tracked jobs exist", () => {
    const snap = computeProgressSnapshot([]);
    expect(snap.allDone).toBe(true);
    expect(snap.stage).toBe("done");
    expect(snap.percent).toBe(0);
    expect(snap.trackedCount).toBe(0);
    expect(snap.runningTypes).toEqual([]);
    expect(snap.percentByType.PULL_COMPROBANTES).toBe(0);
  });

  it("ignores untracked job types", () => {
    const snap = computeProgressSnapshot([job("VALIDATE_CREDENTIALS", "RUNNING", "verify")]);
    expect(snap.trackedCount).toBe(0);
    expect(snap.allDone).toBe(true);
  });

  it("reports connecting stage for a single PULL_COMPROBANTES at login", () => {
    const snap = computeProgressSnapshot(
      [job("PULL_COMPROBANTES", "RUNNING", "login", new Date(FIXED_NOW))],
      FIXED_NOW,
    );
    expect(snap.stage).toBe("connecting");
    expect(snap.allDone).toBe(false);
    expect(snap.hasRunning).toBe(true);
    expect(snap.runningTypes).toEqual(["PULL_COMPROBANTES"]);
  });

  it("reports invoices stage when PULL_COMPROBANTES is downloading", () => {
    const snap = computeProgressSnapshot(
      [job("PULL_COMPROBANTES", "RUNNING", "download", new Date(FIXED_NOW))],
      FIXED_NOW,
    );
    expect(snap.stage).toBe("invoices");
  });

  it("reports classifying stage when PULL_COMPROBANTES reaches classify", () => {
    const snap = computeProgressSnapshot(
      [job("PULL_COMPROBANTES", "RUNNING", "classify", new Date(FIXED_NOW))],
      FIXED_NOW,
    );
    expect(snap.stage).toBe("classifying");
  });

  it("reports receipts stage for a running PULL_DOMESTIC_RECEIPTS download", () => {
    const snap = computeProgressSnapshot(
      [job("PULL_DOMESTIC_RECEIPTS", "RUNNING", "download", new Date(FIXED_NOW))],
      FIXED_NOW,
    );
    expect(snap.stage).toBe("receipts");
  });

  it("reports presentaciones stage for a running PULL_PRESENTACIONES download (not 'receipts')", () => {
    const snap = computeProgressSnapshot(
      [job("PULL_PRESENTACIONES", "RUNNING", "download", new Date(FIXED_NOW))],
      FIXED_NOW,
    );
    expect(snap.stage).toBe("presentaciones");
    expect(snap.stageLabel).toBe("Trayendo presentaciones");
  });

  it("reports employers stage for leftover PULL_PROFILE.empleadores", () => {
    const snap = computeProgressSnapshot(
      [job("PULL_PROFILE", "RUNNING", "empleadores", new Date(FIXED_NOW))],
      FIXED_NOW,
    );
    expect(snap.stage).toBe("employers");
  });

  it("reports dependents stage for leftover PULL_PROFILE.cargas_familia", () => {
    const snap = computeProgressSnapshot(
      [job("PULL_PROFILE", "RUNNING", "cargas_familia", new Date(FIXED_NOW))],
      FIXED_NOW,
    );
    expect(snap.stage).toBe("dependents");
  });

  it("picks the highest stage among multiple concurrent jobs", () => {
    const snap = computeProgressSnapshot(
      [
        job("PULL_COMPROBANTES", "RUNNING", "classify", new Date(FIXED_NOW)),
        job("PULL_DOMESTIC_RECEIPTS", "RUNNING", "login", new Date(FIXED_NOW)),
      ],
      FIXED_NOW,
    );
    expect(snap.stage).toBe("classifying");
    expect(snap.runningTypes).toEqual(
      expect.arrayContaining(["PULL_COMPROBANTES", "PULL_DOMESTIC_RECEIPTS"]),
    );
  });

  it("returns allDone when every tracked job is COMPLETED", () => {
    const snap = computeProgressSnapshot(
      [
        job("PULL_COMPROBANTES", "COMPLETED", "classify"),
        job("PULL_DOMESTIC_RECEIPTS", "COMPLETED", "done"),
        job("PULL_PRESENTACIONES", "COMPLETED", "done"),
      ],
      FIXED_NOW,
    );
    expect(snap.allDone).toBe(true);
    expect(snap.stage).toBe("done");
    expect(snap.percent).toBe(100);
    expect(snap.hasFailed).toBe(false);
    expect(snap.percentByType.PULL_COMPROBANTES).toBe(100);
    expect(snap.percentByType.PULL_DOMESTIC_RECEIPTS).toBe(100);
    expect(snap.percentByType.PULL_PRESENTACIONES).toBe(100);
  });

  it("flags hasFailed when any tracked job is FAILED but still aggregates progress", () => {
    const snap = computeProgressSnapshot(
      [
        job("PULL_COMPROBANTES", "COMPLETED", "classify"),
        job("PULL_DOMESTIC_RECEIPTS", "FAILED", "siradig"),
        job("PULL_PRESENTACIONES", "RUNNING", "download", new Date(FIXED_NOW)),
      ],
      FIXED_NOW,
    );
    expect(snap.hasFailed).toBe(true);
    expect(snap.allDone).toBe(false);
    expect(snap.percent).toBeGreaterThan(0);
    expect(snap.percent).toBeLessThan(100);
  });

  it("computes a percentage between 0 and 100 mid-flight", () => {
    const snap = computeProgressSnapshot(
      [job("PULL_COMPROBANTES", "RUNNING", "siradig_extract", new Date(FIXED_NOW))],
      FIXED_NOW,
    );
    expect(snap.percent).toBeGreaterThan(0);
    expect(snap.percent).toBeLessThan(100);
  });

  it("treats hasFailed=true as not allDone even if all jobs are terminal", () => {
    const snap = computeProgressSnapshot(
      [
        job("PULL_COMPROBANTES", "FAILED", "siradig"),
        job("PULL_DOMESTIC_RECEIPTS", "COMPLETED", "done"),
        job("PULL_PRESENTACIONES", "COMPLETED", "done"),
      ],
      FIXED_NOW,
    );
    expect(snap.hasFailed).toBe(true);
    expect(snap.allDone).toBe(false);
  });

  describe("time-weighted percent", () => {
    it("after PULL_COMPROBANTES.login completes, percent reflects login's small weight (~10%)", () => {
      // Total weight is ~65s; login is 5s. After login completes (now at start of siradig),
      // the percent should be ~5/65 = ~8% (plus whatever in-flight `siradig` accumulates at t=0).
      const snap = computeProgressSnapshot(
        [job("PULL_COMPROBANTES", "RUNNING", "siradig", new Date(FIXED_NOW))],
        FIXED_NOW,
      );
      // 5s before-step / 65s total = ~7.7% — well below the 33% the old formula would give.
      expect(snap.percent).toBeGreaterThanOrEqual(7);
      expect(snap.percent).toBeLessThanOrEqual(10);
    });

    it("at PULL_COMPROBANTES.download with 0 elapsed, percent is ~35% not ~80%", () => {
      // before(download) = login+siradig+siradig_extract+navigate_comprobantes = 5+5+8+5 = 23s.
      // 23/65 = ~35%. Old step-index formula would give 4/6 = 67%.
      const snap = computeProgressSnapshot(
        [job("PULL_COMPROBANTES", "RUNNING", "download", new Date(FIXED_NOW))],
        FIXED_NOW,
      );
      expect(snap.percent).toBeGreaterThanOrEqual(33);
      expect(snap.percent).toBeLessThanOrEqual(38);
    });

    it("in-flight partial weight grows with elapsed time during a step", () => {
      // download is 30s. After 15s elapsed, partial weight = 15s.
      // total = before(download)=23 + 15 in-flight = 38 / 65 = ~58%.
      const startedAt = new Date(FIXED_NOW - 15_000);
      const snap = computeProgressSnapshot(
        [job("PULL_COMPROBANTES", "RUNNING", "download", startedAt)],
        FIXED_NOW,
      );
      expect(snap.percent).toBeGreaterThanOrEqual(56);
      expect(snap.percent).toBeLessThanOrEqual(60);
    });

    it("in-flight partial weight is capped at 90% of the step's expected weight", () => {
      // download is 30s. After 60s elapsed (way over expected), the partial weight
      // is capped at 30 * 0.9 = 27s. So total = 23 + 27 = 50 / 65 = ~77%.
      const startedAt = new Date(FIXED_NOW - 60_000);
      const snap = computeProgressSnapshot(
        [job("PULL_COMPROBANTES", "RUNNING", "download", startedAt)],
        FIXED_NOW,
      );
      expect(snap.percent).toBeGreaterThanOrEqual(75);
      expect(snap.percent).toBeLessThanOrEqual(78);
    });

    it("never reaches 100% while a job is still in-flight", () => {
      const startedAt = new Date(FIXED_NOW - 99_999_000);
      const snap = computeProgressSnapshot(
        [job("PULL_COMPROBANTES", "RUNNING", "classify", startedAt)],
        FIXED_NOW,
      );
      expect(snap.percent).toBeLessThan(100);
    });

    it("missing currentStepStartedAt yields no in-flight weight (just the before-step weight)", () => {
      // No timestamp → no partial. Just before(siradig) = 5s / 65s = ~7%.
      const snap = computeProgressSnapshot(
        [job("PULL_COMPROBANTES", "RUNNING", "siradig", null)],
        FIXED_NOW,
      );
      expect(snap.percent).toBeGreaterThanOrEqual(7);
      expect(snap.percent).toBeLessThanOrEqual(10);
    });
  });

  describe("percentByType", () => {
    it("scopes per-type percent to each tracked job independently", () => {
      const snap = computeProgressSnapshot(
        [
          job("PULL_COMPROBANTES", "COMPLETED", "classify"),
          job("PULL_DOMESTIC_RECEIPTS", "RUNNING", "login", new Date(FIXED_NOW)),
        ],
        FIXED_NOW,
      );
      expect(snap.percentByType.PULL_COMPROBANTES).toBe(100);
      expect(snap.percentByType.PULL_DOMESTIC_RECEIPTS).toBeLessThan(20);
      expect(snap.percentByType.PULL_PRESENTACIONES).toBe(0);
      expect(snap.percentByType.PULL_PROFILE).toBe(0);
    });
  });

  describe("runningTypes", () => {
    it("only includes job types in PENDING or RUNNING status", () => {
      const snap = computeProgressSnapshot(
        [
          job("PULL_COMPROBANTES", "RUNNING", "download", new Date(FIXED_NOW)),
          job("PULL_DOMESTIC_RECEIPTS", "PENDING", null),
          job("PULL_PRESENTACIONES", "COMPLETED", "done"),
          job("PULL_PROFILE", "FAILED", "siradig"),
        ],
        FIXED_NOW,
      );
      expect(snap.runningTypes).toEqual(
        expect.arrayContaining(["PULL_COMPROBANTES", "PULL_DOMESTIC_RECEIPTS"]),
      );
      expect(snap.runningTypes).toHaveLength(2);
    });
  });

  describe("PENDING jobs don't drag down the percent", () => {
    it("queueing a new tracked import while one is running keeps the strip's percent intact", () => {
      // Baseline: PULL_PROFILE alone, sitting on `cargas_familia` for 4s.
      // before(cargas_familia) = 5+5+8+8 = 26s, +4s in-flight, total = 50s
      // → 30/50 = 60%.
      const startedAt = new Date(FIXED_NOW - 4_000);
      const baselineSnap = computeProgressSnapshot(
        [job("PULL_PROFILE", "RUNNING", "cargas_familia", startedAt)],
        FIXED_NOW,
      );
      expect(baselineSnap.percent).toBe(60);

      // The user clicks "Importar comprobantes" while PULL_PROFILE is still
      // running. The new tracked import gets queued as PENDING. Its full
      // duration must NOT inflate the denominator — the strip should stay
      // focused on the actively running task at the same percent.
      const withQueuedSnap = computeProgressSnapshot(
        [
          job("PULL_PROFILE", "RUNNING", "cargas_familia", startedAt),
          job("PULL_COMPROBANTES", "PENDING", null),
        ],
        FIXED_NOW,
      );
      expect(withQueuedSnap.percent).toBe(60);
      // The queued type still appears in runningTypes so per-row buttons can
      // show "Esperando…".
      expect(withQueuedSnap.runningTypes).toContain("PULL_COMPROBANTES");
      expect(withQueuedSnap.percentByType.PULL_COMPROBANTES).toBe(0);
    });
  });
});

describe("getJobTypeLabel / JOB_TYPE_LABELS", () => {
  it("resolves the spec-mandated label for every JobType the strip surfaces", () => {
    const expected: Record<string, string> = {
      PULL_COMPROBANTES: "Trayendo comprobantes",
      PULL_DOMESTIC_RECEIPTS: "Trayendo recibos",
      PULL_PRESENTACIONES: "Trayendo presentaciones",
      PULL_PROFILE: "Trayendo cargas de familia",
      SUBMIT_INVOICE: "Desgravando comprobante",
      SUBMIT_DOMESTIC_DEDUCTION: "Desgravando recibo",
      SUBMIT_PRESENTACION: "Generando presentación",
      PUSH_FAMILY_DEPENDENTS: "Cargando familiares en SiRADIG",
      BULK_SUBMIT: "Desgravando comprobantes",
      VALIDATE_CREDENTIALS: "Validando credenciales",
    };
    for (const [jobType, label] of Object.entries(expected)) {
      expect(getJobTypeLabel(jobType)).toBe(label);
      expect(JOB_TYPE_LABELS[jobType]).toBe(label);
    }
  });

  it("falls back to a generic label for unknown job types", () => {
    expect(getJobTypeLabel("SOMETHING_ELSE")).toBe("Procesando tarea");
  });
});

describe("JOB_STEP_DURATIONS for SUBMIT_*", () => {
  it("each SUBMIT_* job sums to 30 seconds total", () => {
    const submitTypes = [
      "SUBMIT_INVOICE",
      "BULK_SUBMIT",
      "SUBMIT_DOMESTIC_DEDUCTION",
      "SUBMIT_PRESENTACION",
    ];
    for (const t of submitTypes) {
      const total = Object.values(JOB_STEP_DURATIONS[t] ?? {}).reduce((a, b) => a + b, 0);
      expect(total).toBe(30);
    }
  });
});

describe("computeJobPercent", () => {
  function job(
    jobType: string,
    status: JobLite["status"],
    currentStep: string | null,
    startedAt: Date | null,
  ): JobLite {
    return { jobType, status, currentStep, currentStepStartedAt: startedAt };
  }

  it("returns null for a job type with no JOB_STEP_DURATIONS entry", () => {
    expect(computeJobPercent(job("UNKNOWN_TYPE", "RUNNING", "login", null))).toBeNull();
  });

  it("returns 100 for COMPLETED jobs", () => {
    expect(computeJobPercent(job("SUBMIT_INVOICE", "COMPLETED", "done", null))).toBe(100);
  });

  it("computes time-weighted percent for SUBMIT_INVOICE on the fill step", () => {
    // login 5 + siradig 5 + fill 19 + done 1 = 30s. Sitting on `fill` for 5s
    // → before 10s + 5s in-flight = 15/30 = 50%.
    const startedAt = new Date("2026-05-01T12:00:00Z");
    const now = new Date("2026-05-01T12:00:05Z").getTime();
    expect(computeJobPercent(job("SUBMIT_INVOICE", "RUNNING", "fill", startedAt), now)).toBe(50);
  });

  it("returns 0 for a freshly RUNNING job that hasn't started any step yet", () => {
    expect(computeJobPercent(job("SUBMIT_INVOICE", "RUNNING", null, null))).toBe(0);
  });

  it("freezes at the failed step boundary for FAILED jobs", () => {
    // Failed at `fill`: before-fill weight = 10s, total = 30s → 33%.
    expect(computeJobPercent(job("SUBMIT_INVOICE", "FAILED", "fill", null))).toBe(33);
  });
});
