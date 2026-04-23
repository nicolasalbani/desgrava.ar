import { prisma } from "@/lib/prisma";
import { classifyCategory } from "@/lib/ocr/category-classifier";
import {
  isObviouslyNonDeductible,
  lookupCuit360,
  lookupCuitOnline,
  type WebLookupResult,
} from "@/lib/catalog/provider-catalog";
import { sendCatalogReviewProposal } from "@/lib/telegram";
import type { DeductionCategory } from "@/generated/prisma/client";

export const MAX_REVIEWS_PER_RUN = 50;
export const REVIEW_SKIP_DAYS = 30;

export interface ReviewSummary {
  processed: number;
  flagged: number;
  skipped: number;
}

export interface InvoiceMetadata {
  providerName: string | null;
  invoiceType: string | null;
  averageAmount: number | null;
  invoiceCount: number;
  userCount: number;
}

/**
 * Aggregate metadata across all NO_DEDUCIBLE invoices for a CUIT.
 * Used to build classifier context and to populate the Telegram message.
 */
export async function aggregateInvoiceMetadata(cuit: string): Promise<InvoiceMetadata> {
  const invoices = await prisma.invoice.findMany({
    where: {
      providerCuit: cuit,
      deductionCategory: "NO_DEDUCIBLE",
    },
    select: {
      providerName: true,
      invoiceType: true,
      amount: true,
      userId: true,
    },
  });

  if (invoices.length === 0) {
    return {
      providerName: null,
      invoiceType: null,
      averageAmount: null,
      invoiceCount: 0,
      userCount: 0,
    };
  }

  const providerName = mostCommon(invoices.map((i) => i.providerName).filter(isString));
  const invoiceType = mostCommon(invoices.map((i) => i.invoiceType));
  const totalAmount = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
  const averageAmount = totalAmount / invoices.length;
  const userCount = new Set(invoices.map((i) => i.userId)).size;

  return {
    providerName,
    invoiceType,
    averageAmount,
    invoiceCount: invoices.length,
    userCount,
  };
}

function isString(v: string | null): v is string {
  return typeof v === "string" && v.length > 0;
}

function mostCommon<T extends string>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: T | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function buildClassifierContext(
  cuit: string,
  metadata: InvoiceMetadata,
  web: WebLookupResult | null,
): string {
  const parts: string[] = [`CUIT: ${cuit}`];
  if (metadata.providerName) parts.push(`Proveedor: ${metadata.providerName}`);
  if (metadata.invoiceType) parts.push(`Tipo: ${metadata.invoiceType}`);
  if (metadata.averageAmount != null) {
    parts.push(`Monto promedio: $${Math.round(metadata.averageAmount)}`);
  }
  if (web?.razonSocial) parts.push(`Razón social: ${web.razonSocial}`);
  if (web?.actividades && web.actividades.length > 0) {
    parts.push(`Actividades registradas: ${web.actividades.join(", ")}`);
  }
  return parts.join(" | ");
}

/**
 * Daily batch that re-classifies NO_DEDUCIBLE catalog entries.
 *
 * For each entry:
 *  1. Skip if reviewed in the last REVIEW_SKIP_DAYS days
 *  2. Skip if the provider name matches the hardcoded non-deductible keywords
 *  3. Skip if there is already an open proposal for this CUIT
 *  4. Skip if there are zero NO_DEDUCIBLE invoices to act on
 *  5. Fresh web lookup + AI classification using aggregated invoice metadata
 *  6. If the result is deductible, create a proposal and send a Telegram message
 *
 * Bounded to MAX_REVIEWS_PER_RUN per run to control cost.
 */
export async function reviewNonDeductibleCatalog(): Promise<ReviewSummary> {
  const cutoff = new Date(Date.now() - REVIEW_SKIP_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.providerCatalog.findMany({
    where: {
      deductionCategory: "NO_DEDUCIBLE",
      OR: [{ lastReviewedAt: null }, { lastReviewedAt: { lt: cutoff } }],
    },
    orderBy: { lastReviewedAt: { sort: "asc", nulls: "first" } },
    take: MAX_REVIEWS_PER_RUN,
  });

  let processed = 0;
  let flagged = 0;
  let skipped = 0;

  for (const entry of candidates) {
    processed++;

    if (entry.razonSocial && isObviouslyNonDeductible(entry.razonSocial)) {
      await touchLastReviewed(entry.cuit);
      skipped++;
      continue;
    }

    const existingProposal = await prisma.catalogReviewProposal.findFirst({
      where: { cuit: entry.cuit, resolvedAt: null },
    });
    if (existingProposal) {
      skipped++;
      continue;
    }

    const metadata = await aggregateInvoiceMetadata(entry.cuit);
    if (metadata.invoiceCount === 0) {
      await touchLastReviewed(entry.cuit);
      skipped++;
      continue;
    }

    const web = (await lookupCuit360(entry.cuit)) ?? (await lookupCuitOnline(entry.cuit));
    const context = buildClassifierContext(entry.cuit, metadata, web);
    const proposedCategory = await classifyCategory(context);

    await touchLastReviewed(entry.cuit);

    if (proposedCategory === "NO_DEDUCIBLE") {
      skipped++;
      continue;
    }

    const razonSocial = web?.razonSocial ?? entry.razonSocial ?? metadata.providerName;
    const activityDescription = web?.actividades?.[0] ?? null;

    const messageId = await sendCatalogReviewProposal({
      cuit: entry.cuit,
      razonSocial,
      proposedCategory,
      invoiceCount: metadata.invoiceCount,
      userCount: metadata.userCount,
      activityDescription,
    });

    await prisma.catalogReviewProposal.create({
      data: {
        cuit: entry.cuit,
        proposedCategory: proposedCategory as DeductionCategory,
        telegramMessageId: messageId?.toString() ?? null,
      },
    });

    flagged++;
  }

  return { processed, flagged, skipped };
}

async function touchLastReviewed(cuit: string): Promise<void> {
  await prisma.providerCatalog.update({
    where: { cuit },
    data: { lastReviewedAt: new Date() },
  });
}

export interface ApprovalResult {
  status: "approved" | "already_resolved" | "not_found";
  newCategory?: string;
  affectedUserEmails?: string[];
  telegramMessageId?: number | null;
}

/**
 * Apply an admin approval for a CUIT proposal.
 * Updates the catalog entry, the affected invoices, and marks the proposal resolved.
 * Returns the emails of users whose invoices changed so the caller can notify them.
 */
export async function approveCatalogProposal(cuit: string): Promise<ApprovalResult> {
  const proposal = await prisma.catalogReviewProposal.findFirst({
    where: { cuit, resolvedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!proposal) {
    const resolved = await prisma.catalogReviewProposal.findFirst({
      where: { cuit },
      orderBy: { createdAt: "desc" },
    });
    return {
      status: resolved ? "already_resolved" : "not_found",
      telegramMessageId: resolved?.telegramMessageId ? Number(resolved.telegramMessageId) : null,
    };
  }

  const affectedInvoices = await prisma.invoice.findMany({
    where: { providerCuit: cuit, deductionCategory: "NO_DEDUCIBLE" },
    select: { userId: true },
  });
  const userIds = [...new Set(affectedInvoices.map((i) => i.userId))];

  await prisma.$transaction([
    prisma.providerCatalog.update({
      where: { cuit },
      data: {
        deductionCategory: proposal.proposedCategory,
        source: "MANUAL",
        lastReviewedAt: new Date(),
      },
    }),
    prisma.invoice.updateMany({
      where: { providerCuit: cuit, deductionCategory: "NO_DEDUCIBLE" },
      data: { deductionCategory: proposal.proposedCategory },
    }),
    prisma.catalogReviewProposal.update({
      where: { id: proposal.id },
      data: { resolvedAt: new Date(), resolution: "APPROVED" },
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { email: true },
  });
  const affectedUserEmails = users.map((u) => u.email).filter(isString);

  return {
    status: "approved",
    newCategory: proposal.proposedCategory,
    affectedUserEmails,
    telegramMessageId: proposal.telegramMessageId ? Number(proposal.telegramMessageId) : null,
  };
}

export interface RejectionResult {
  status: "rejected" | "already_resolved" | "not_found";
  telegramMessageId?: number | null;
}

/**
 * Apply an admin rejection for a CUIT proposal.
 * Marks the proposal resolved and refreshes lastReviewedAt so the CUIT is skipped
 * for REVIEW_SKIP_DAYS before being re-reviewed.
 */
export async function rejectCatalogProposal(cuit: string): Promise<RejectionResult> {
  const proposal = await prisma.catalogReviewProposal.findFirst({
    where: { cuit, resolvedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!proposal) {
    const resolved = await prisma.catalogReviewProposal.findFirst({
      where: { cuit },
      orderBy: { createdAt: "desc" },
    });
    return {
      status: resolved ? "already_resolved" : "not_found",
      telegramMessageId: resolved?.telegramMessageId ? Number(resolved.telegramMessageId) : null,
    };
  }

  await prisma.$transaction([
    prisma.catalogReviewProposal.update({
      where: { id: proposal.id },
      data: { resolvedAt: new Date(), resolution: "REJECTED" },
    }),
    prisma.providerCatalog.update({
      where: { cuit },
      data: { lastReviewedAt: new Date() },
    }),
  ]);

  return {
    status: "rejected",
    telegramMessageId: proposal.telegramMessageId ? Number(proposal.telegramMessageId) : null,
  };
}
