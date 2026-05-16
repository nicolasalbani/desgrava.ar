import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildIssueBody,
  type AutomationJobSnapshot,
  type CreateSupportIssueInput,
} from "@/lib/github/issues";
import type { ChatMessage } from "@/lib/soporte/types";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function baseInput(overrides: Partial<CreateSupportIssueInput> = {}): CreateSupportIssueInput {
  return {
    subject: "Login broken",
    description: "Can't log in with Google",
    userId: "user-abc",
    userEmail: "user@test.com",
    conversationId: "conv-xyz",
    pageUrl: "/panel",
    submittedAt: "2026-05-16T01:23:45.678Z",
    environment: "development",
    automationJob: null,
    conversationLog: [],
    ...overrides,
  };
}

const SAMPLE_JOB: AutomationJobSnapshot = {
  id: "job-cmp5gfa",
  jobType: "SUBMIT_INVOICE",
  jobTypeLabel: "Envío de factura a SiRADIG",
  status: "FAILED",
  errorMessage: "Comprobante no agregado: La fecha debe estar dentro del mes indicado (Marzo)...",
  currentStep: "presionar-agregar",
  fiscalYear: 2026,
  createdAt: "2026-05-14T10:00:00.000Z",
  startedAt: "2026-05-14T10:00:05.000Z",
  completedAt: "2026-05-14T10:01:30.000Z",
  relatedEntity: {
    kind: "invoice",
    id: "inv-123",
    label: "PIETRUSZKA DIANA MYRIAN",
    details: {
      providerCuit: "27-12345678-9",
      invoiceType: "FACTURA_C",
      invoiceNumber: "A-0001-00000123",
      invoiceDate: "2026-04-15",
      amount: "12500.00",
      fiscalYear: 2026,
      fiscalMonth: 4,
      deductionCategory: "GASTOS_MEDICOS",
      source: "ARCA",
      siradiqStatus: "PENDING",
    },
  },
};

describe("buildIssueBody — reporter section", () => {
  it("includes userEmail, userId, conversationId, environment and submittedAt", () => {
    const body = buildIssueBody(baseInput());
    expect(body).toContain("## Reporter");
    expect(body).toContain("**User:** user@test.com");
    expect(body).toContain("`userId`: `user-abc`");
    expect(body).toContain("**Support conversation:** `conv-xyz`");
    expect(body).toContain("**Page:** /panel");
    expect(body).toContain("**Environment:** development");
    expect(body).toContain("**Submitted at:** 2026-05-16T01:23:45.678Z");
  });

  it("omits the Page line when pageUrl is null", () => {
    const body = buildIssueBody(baseInput({ pageUrl: null }));
    expect(body).not.toContain("**Page:**");
  });

  it("preserves the description verbatim", () => {
    const body = buildIssueBody(baseInput({ description: "no anda el botón A" }));
    expect(body).toContain("## Description");
    expect(body).toContain("no anda el botón A");
  });
});

describe("buildIssueBody — failed automation section", () => {
  it("omits the section entirely when there is no automation job", () => {
    const body = buildIssueBody(baseInput({ automationJob: null }));
    expect(body).not.toContain("## Failed automation");
  });

  it("renders the full job snapshot with type, status, step, error, timestamps", () => {
    const body = buildIssueBody(baseInput({ automationJob: SAMPLE_JOB }));
    expect(body).toContain("## Failed automation");
    expect(body).toContain("**Job ID:** `job-cmp5gfa`");
    expect(body).toContain("**Type:** `SUBMIT_INVOICE` (Envío de factura a SiRADIG)");
    expect(body).toContain("**Status:** FAILED");
    expect(body).toContain("**Fiscal year:** 2026");
    expect(body).toContain("**Failed at step:** `presionar-agregar`");
    expect(body).toContain("**Error:** Comprobante no agregado");
    expect(body).toContain("**Created at:** 2026-05-14T10:00:00.000Z");
    expect(body).toContain("**Started at:** 2026-05-14T10:00:05.000Z");
    expect(body).toContain("**Completed at:** 2026-05-14T10:01:30.000Z");
  });

  it("renders related entity with id and structured details (skipping null/empty values)", () => {
    const body = buildIssueBody(baseInput({ automationJob: SAMPLE_JOB }));
    expect(body).toContain("**Related entity (invoice):** PIETRUSZKA DIANA MYRIAN");
    expect(body).toContain("`id`: `inv-123`");
    expect(body).toContain("`providerCuit`: 27-12345678-9");
    expect(body).toContain("`invoiceNumber`: A-0001-00000123");
    expect(body).toContain("`amount`: 12500.00");
    expect(body).toContain("`deductionCategory`: GASTOS_MEDICOS");
  });

  it("skips null/empty detail fields", () => {
    const job: AutomationJobSnapshot = {
      ...SAMPLE_JOB,
      relatedEntity: {
        kind: "invoice",
        id: "inv-x",
        label: "ACME",
        details: {
          providerCuit: "20-11111111-1",
          invoiceNumber: null,
          invoiceDate: "",
          amount: "100.00",
        },
      },
    };
    const body = buildIssueBody(baseInput({ automationJob: job }));
    expect(body).toContain("`providerCuit`: 20-11111111-1");
    expect(body).toContain("`amount`: 100.00");
    expect(body).not.toContain("`invoiceNumber`:");
    expect(body).not.toContain("`invoiceDate`:");
  });

  it("renders a domesticReceipt-kind related entity", () => {
    const job: AutomationJobSnapshot = {
      ...SAMPLE_JOB,
      jobType: "SUBMIT_DOMESTIC_DEDUCTION",
      jobTypeLabel: "Envío de deducción de servicio doméstico",
      relatedEntity: {
        kind: "domesticReceipt",
        id: "rcpt-1",
        label: "Pérez — 2026-03",
        details: { periodo: "2026-03", domesticWorkerId: "w-7", receiptCount: 1 },
      },
    };
    const body = buildIssueBody(baseInput({ automationJob: job }));
    expect(body).toContain("**Related entity (domesticReceipt):** Pérez — 2026-03");
    expect(body).toContain("`domesticWorkerId`: w-7");
  });
});

describe("buildIssueBody — conversation log", () => {
  it("renders a collapsible details block when messages exist", () => {
    const conversationLog: ChatMessage[] = [
      { role: "user", content: "no anda" },
      { role: "assistant", content: "contame más" },
    ];
    const body = buildIssueBody(baseInput({ conversationLog }));
    expect(body).toContain("<details>");
    expect(body).toContain("<summary>Conversation log</summary>");
    expect(body).toContain("**User**: no anda");
    expect(body).toContain("**Ganancio**: contame más");
    expect(body).toContain("</details>");
  });

  it("omits the conversation log block when empty", () => {
    const body = buildIssueBody(baseInput({ conversationLog: [] }));
    expect(body).not.toContain("<details>");
  });
});

describe("createSupportIssue", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.GITHUB_TOKEN = "ghp_test_token";
    process.env.GITHUB_REPO = "owner/repo";
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPO;
  });

  it("POSTs to the GitHub issues endpoint with title, body and label", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ number: 42, html_url: "https://github.com/owner/repo/issues/42" }),
    });
    const { createSupportIssue, SUPPORT_ISSUE_LABEL } = await import("@/lib/github/issues");

    const result = await createSupportIssue(baseInput({ automationJob: SAMPLE_JOB }));

    expect(result).toEqual({ number: 42, url: "https://github.com/owner/repo/issues/42" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/issues");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer ghp_test_token");
    expect(options.headers.Accept).toBe("application/vnd.github+json");
    const body = JSON.parse(options.body);
    expect(body.title).toBe("Login broken");
    expect(body.body).toContain("`userId`: `user-abc`");
    expect(body.body).toContain("## Failed automation");
    expect(body.labels).toEqual([SUPPORT_ISSUE_LABEL]);
  });

  it("throws when GITHUB_TOKEN is missing", async () => {
    delete process.env.GITHUB_TOKEN;
    const { createSupportIssue } = await import("@/lib/github/issues");

    await expect(createSupportIssue(baseInput())).rejects.toThrow(/GITHUB_TOKEN/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when GITHUB_REPO is missing", async () => {
    delete process.env.GITHUB_REPO;
    const { createSupportIssue } = await import("@/lib/github/issues");

    await expect(createSupportIssue(baseInput())).rejects.toThrow(/GITHUB_REPO/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws on non-2xx response from GitHub", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve("Validation failed"),
    });
    const { createSupportIssue } = await import("@/lib/github/issues");

    await expect(createSupportIssue(baseInput())).rejects.toThrow(/GitHub API error 422/);
  });
});
