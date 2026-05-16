import type { ChatMessage } from "@/lib/soporte/types";

const GITHUB_API = "https://api.github.com";
export const SUPPORT_ISSUE_LABEL = "from-app";

export interface AutomationJobRelatedEntity {
  kind: "invoice" | "presentacion" | "employer" | "familyDependent" | "domesticReceipt";
  id: string;
  /** Short human-readable label, e.g. "PIETRUSZKA DIANA MYRIAN" or "Presentación 2026". */
  label: string;
  /**
   * Additional structured fields rendered as a bullet list in the issue body.
   * Keys are shown verbatim — pick stable, fix-ticket-friendly names.
   */
  details: Record<string, string | number | null>;
}

export interface AutomationJobSnapshot {
  id: string;
  jobType: string;
  jobTypeLabel: string;
  status: string;
  errorMessage: string | null;
  currentStep: string | null;
  fiscalYear: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  relatedEntity: AutomationJobRelatedEntity | null;
}

export interface CreateSupportIssueInput {
  subject: string;
  description: string;
  userId: string;
  userEmail: string;
  conversationId: string;
  pageUrl: string | null;
  submittedAt: string;
  environment: string;
  automationJob: AutomationJobSnapshot | null;
  conversationLog: ChatMessage[];
}

export interface CreateSupportIssueResult {
  number: number;
  url: string;
}

function getConfig(): { token: string; repo: string } {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    throw new Error(
      "GitHub support issues require GITHUB_TOKEN and GITHUB_REPO environment variables",
    );
  }
  return { token, repo };
}

function renderRelatedEntity(entity: AutomationJobRelatedEntity): string[] {
  const lines: string[] = [];
  lines.push(`- **Related entity (${entity.kind}):** ${entity.label}`);
  lines.push(`  - \`id\`: \`${entity.id}\``);
  for (const [key, value] of Object.entries(entity.details)) {
    if (value === null || value === undefined || value === "") continue;
    lines.push(`  - \`${key}\`: ${value}`);
  }
  return lines;
}

function renderAutomationJob(job: AutomationJobSnapshot): string[] {
  const lines: string[] = [];
  lines.push("## Failed automation");
  lines.push("");
  lines.push(`- **Job ID:** \`${job.id}\``);
  lines.push(`- **Type:** \`${job.jobType}\` (${job.jobTypeLabel})`);
  lines.push(`- **Status:** ${job.status}`);
  if (job.fiscalYear !== null) lines.push(`- **Fiscal year:** ${job.fiscalYear}`);
  if (job.currentStep) lines.push(`- **Failed at step:** \`${job.currentStep}\``);
  if (job.errorMessage) lines.push(`- **Error:** ${job.errorMessage}`);
  lines.push(`- **Created at:** ${job.createdAt}`);
  if (job.startedAt) lines.push(`- **Started at:** ${job.startedAt}`);
  if (job.completedAt) lines.push(`- **Completed at:** ${job.completedAt}`);
  if (job.relatedEntity) {
    lines.push(...renderRelatedEntity(job.relatedEntity));
  }
  return lines;
}

export function buildIssueBody(input: CreateSupportIssueInput): string {
  const {
    description,
    userId,
    userEmail,
    conversationId,
    pageUrl,
    submittedAt,
    environment,
    automationJob,
    conversationLog,
  } = input;

  const lines: string[] = [];

  lines.push("## Reporter");
  lines.push("");
  lines.push(`- **User:** ${userEmail}`);
  lines.push(`  - \`userId\`: \`${userId}\``);
  lines.push(`- **Support conversation:** \`${conversationId}\``);
  if (pageUrl) lines.push(`- **Page:** ${pageUrl}`);
  lines.push(`- **Environment:** ${environment}`);
  lines.push(`- **Submitted at:** ${submittedAt}`);
  lines.push("");
  lines.push("## Description");
  lines.push("");
  lines.push(description);

  if (automationJob) {
    lines.push("");
    lines.push(...renderAutomationJob(automationJob));
  }

  if (conversationLog.length > 0) {
    lines.push("");
    lines.push("<details>");
    lines.push("<summary>Conversation log</summary>");
    lines.push("");
    for (const m of conversationLog) {
      const speaker = m.role === "user" ? "**User**" : "**Ganancio**";
      lines.push(`${speaker}: ${m.content}`);
      lines.push("");
    }
    lines.push("</details>");
  }

  return lines.join("\n");
}

export async function createSupportIssue(
  input: CreateSupportIssueInput,
): Promise<CreateSupportIssueResult> {
  const { token, repo } = getConfig();

  const url = `${GITHUB_API}/repos/${repo}/issues`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.subject,
      body: buildIssueBody(input),
      labels: [SUPPORT_ISSUE_LABEL],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { number: number; html_url: string };
  return { number: data.number, url: data.html_url };
}
