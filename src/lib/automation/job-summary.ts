import type { Prisma } from "@/generated/prisma/client";

/**
 * Narrow projection of `AutomationJob` returned by the polled
 * `GET /api/automatizacion` endpoint. Defined in one place so the route
 * handler, the `useArcaImportProgress` hook, and any other consumer agree
 * on the wire shape.
 *
 * The default Prisma include with the full `invoice` row blows the JSON
 * payload up to several KB per job — at one poll every 4 seconds across
 * 50 jobs that's hundreds of KB per minute the browser doesn't actually
 * read. This `select` keeps the payload to the fields the UI renders.
 */
export const jobSummarySelect = {
  id: true,
  jobType: true,
  status: true,
  currentStep: true,
  currentStepStartedAt: true,
  createdAt: true,
  completedAt: true,
  fiscalYear: true,
  notifyOnComplete: true,
  invoiceId: true,
  familyDependentId: true,
  employerId: true,
  resultData: true,
  invoice: {
    select: {
      providerName: true,
      providerCuit: true,
      invoiceNumber: true,
      invoiceDate: true,
      amount: true,
      deductionCategory: true,
    },
  },
} as const satisfies Prisma.AutomationJobSelect;

/**
 * Inferred wire shape from the select.
 *
 * The route handler serializes Decimal `amount` to a string via JSON and
 * Date fields to ISO strings, so this differs from the Prisma payload at
 * runtime — clients should treat date/decimal fields as their string forms.
 */
export type JobSummary = Prisma.AutomationJobGetPayload<{ select: typeof jobSummarySelect }>;

/** Fields a consumer can hard-rely on (status semantics, identity, type). */
export const JOB_SUMMARY_REQUIRED_KEYS = [
  "id",
  "jobType",
  "status",
  "currentStep",
  "currentStepStartedAt",
  "createdAt",
  "completedAt",
  "fiscalYear",
  "notifyOnComplete",
  "invoiceId",
  "familyDependentId",
  "employerId",
  "resultData",
  "invoice",
] as const;
