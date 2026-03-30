import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createInvoiceSchema } from "@/lib/validators/invoice";
import { Prisma } from "@/generated/prisma/client";
import { matchDependent, buildInvoiceText } from "@/lib/matching/dependent-matcher";
import { requireWriteAccess } from "@/lib/subscription/require-write-access";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;

  // Pagination
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10")));

  // Filters
  const fiscalYear = searchParams.get("fiscalYear");
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const categories = searchParams.get("categories");
  const statuses = searchParams.get("statuses");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const amountMin = searchParams.get("amountMin");
  const amountMax = searchParams.get("amountMax");
  const attentionFilter = searchParams.get("attentionFilter");

  const where: Prisma.InvoiceWhereInput = {
    userId: session.user.id,
    NOT: { deductionCategory: "NO_DEDUCIBLE" },
  };

  if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);
  if (status) where.siradiqStatus = status as Prisma.EnumSiradiqStatusFilter["equals"];
  if (category) where.deductionCategory = category as Prisma.EnumDeductionCategoryFilter["equals"];

  // Multi-value category filter
  if (categories) {
    const catList = categories.split(",").filter(Boolean);
    if (catList.length > 0) {
      where.deductionCategory = { in: catList as Prisma.EnumDeductionCategoryFilter["in"] };
    }
  }

  // Multi-value status filter (job status — requires filtering via automationJobs relation)
  // Note: statuses filter is applied post-query for job status since it's on a relation

  // Search across provider name, CUIT, and invoice number
  if (search) {
    where.OR = [
      { providerName: { contains: search, mode: "insensitive" } },
      { providerCuit: { contains: search } },
      { invoiceNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  // Date range filter
  if (dateFrom || dateTo) {
    where.invoiceDate = {};
    if (dateFrom) where.invoiceDate.gte = new Date(dateFrom);
    if (dateTo) where.invoiceDate.lte = new Date(dateTo);
  }

  // Amount range filter
  if (amountMin || amountMax) {
    where.amount = {};
    if (amountMin) where.amount.gte = new Prisma.Decimal(amountMin);
    if (amountMax) where.amount.lte = new Prisma.Decimal(amountMax);
  }

  // Build a "base" where without statuses/attentionFilter so we can derive available filter options
  const baseWhere: Prisma.InvoiceWhereInput = { ...where };

  // Apply status filter at DB level (pre-pagination) via automationJobs relation
  if (statuses) {
    const statusList = statuses.split(",").filter(Boolean);
    if (statusList.length > 0) {
      const NO_JOB = "__NO_JOB__";
      const hasNoJob = statusList.includes(NO_JOB);
      const jobStatuses = statusList.filter((s) => s !== NO_JOB);

      const statusConditions: Prisma.InvoiceWhereInput[] = [];
      if (jobStatuses.length > 0) {
        statusConditions.push({
          automationJobs: {
            some: {
              jobType: "SUBMIT_INVOICE",
              status: { in: jobStatuses as Prisma.EnumJobStatusFilter["in"] },
            },
          },
        });
      }
      if (hasNoJob) {
        statusConditions.push({
          automationJobs: { none: { jobType: "SUBMIT_INVOICE" } },
        });
      }
      if (statusConditions.length === 1) {
        Object.assign(where, statusConditions[0]);
      } else if (statusConditions.length > 1) {
        where.OR = [...(where.OR ?? []), ...statusConditions];
      }
    }
  }

  // Apply attention filter at DB level (pre-pagination)
  if (attentionFilter === "true") {
    where.OR = [
      { automationJobs: { none: { jobType: "SUBMIT_INVOICE" } } },
      { automationJobs: { some: { jobType: "SUBMIT_INVOICE", status: "FAILED" } } },
      { deductionCategory: "GASTOS_EDUCATIVOS", familyDependentId: null },
    ];
  }

  const [invoices, totalCount, distinctJobStatuses, invoicesWithoutJobs, distinctCategories] =
    await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          deductionCategory: true,
          providerCuit: true,
          providerName: true,
          invoiceType: true,
          invoiceNumber: true,
          invoiceDate: true,
          amount: true,
          fiscalYear: true,
          fiscalMonth: true,
          source: true,
          siradiqStatus: true,
          originalFilename: true,
          fileMimeType: true,
          contractStartDate: true,
          contractEndDate: true,
          familyDependentId: true,
          familyDependent: { select: { id: true, nombre: true, apellido: true } },
          createdAt: true,
          automationJobs: {
            where: { jobType: "SUBMIT_INVOICE" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, createdAt: true, errorMessage: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
      // Distinct job statuses across all matching invoices (for filter options)
      prisma.automationJob.groupBy({
        by: ["status"],
        where: {
          jobType: "SUBMIT_INVOICE",
          invoice: { ...baseWhere },
        },
      }),
      // Check if any matching invoices have no jobs at all
      prisma.invoice.count({
        where: {
          ...baseWhere,
          automationJobs: { none: { jobType: "SUBMIT_INVOICE" } },
        },
      }),
      // Distinct categories across all matching invoices (for filter options)
      prisma.invoice.groupBy({
        by: ["deductionCategory"],
        where: baseWhere,
      }),
    ]);

  const result = invoices.map((inv) => {
    const { automationJobs, ...rest } = inv;
    return {
      ...rest,
      hasFile: !!inv.fileMimeType,
      latestJob: automationJobs[0] ?? null,
    };
  });

  const availableStatuses: string[] = distinctJobStatuses.map((s) => s.status);
  if (invoicesWithoutJobs > 0) availableStatuses.push("__NO_JOB__");

  const availableCategories: string[] = distinctCategories.map((c) => c.deductionCategory);

  return NextResponse.json({
    invoices: result,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
    availableStatuses,
    availableCategories,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const denied = await requireWriteAccess(session.user.id);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { fileBase64, fileMimeType, originalFilename, ...invoiceBody } = body;
    const parsed = createInvoiceSchema.safeParse(invoiceBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (parsed.data.invoiceNumber) {
      const duplicate = await prisma.invoice.findFirst({
        where: { userId: session.user.id, invoiceNumber: parsed.data.invoiceNumber },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "Ya existe un comprobante con ese número" },
          { status: 409 },
        );
      }
    }

    // Auto-link education invoices to a family dependent
    let familyDependentId: string | null = parsed.data.familyDependentId ?? null;
    if (parsed.data.deductionCategory === "GASTOS_EDUCATIVOS" && !familyDependentId) {
      const dependents = await prisma.familyDependent.findMany({
        where: { userId: session.user.id, fiscalYear: parsed.data.fiscalYear },
        select: { id: true, nombre: true, apellido: true },
      });
      const text = buildInvoiceText({
        description: parsed.data.description,
        providerName: parsed.data.providerName,
      });
      const result = matchDependent(text, dependents);
      familyDependentId = result.dependentId;
      if (result.reason !== "no_match") {
        console.log(
          `[auto-link] invoice match: ${result.reason}${result.matchedName ? ` (${result.matchedName})` : ""}`,
        );
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        userId: session.user.id,
        ...parsed.data,
        amount: new Prisma.Decimal(parsed.data.amount),
        familyDependentId,
        source: fileBase64 ? "PDF" : "MANUAL",
        ...(fileBase64
          ? {
              fileData: Buffer.from(fileBase64, "base64"),
              fileMimeType: fileMimeType || "application/octet-stream",
              originalFilename: originalFilename || null,
            }
          : {}),
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json({ error: "Error al crear factura" }, { status: 500 });
  }
}
