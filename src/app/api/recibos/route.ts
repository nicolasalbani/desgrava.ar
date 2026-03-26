import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDomesticReceiptSchema } from "@/lib/validators/domestic";
import { Prisma } from "@/generated/prisma/client";

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
  const workerId = searchParams.get("workerId");
  const categories = searchParams.get("categories");
  const statuses = searchParams.get("statuses");
  const search = searchParams.get("search");
  const totalMin = searchParams.get("totalMin");
  const totalMax = searchParams.get("totalMax");
  const contribMin = searchParams.get("contribMin");
  const contribMax = searchParams.get("contribMax");
  const attentionFilter = searchParams.get("attentionFilter");

  const where: Prisma.DomesticReceiptWhereInput = {
    userId: session.user.id,
  };

  if (fiscalYear) where.fiscalYear = parseInt(fiscalYear);
  if (status) where.siradiqStatus = status as Prisma.EnumSiradiqStatusFilter["equals"];
  if (workerId) where.domesticWorkerId = workerId;

  // Multi-value category filter
  if (categories) {
    const catList = categories.split(",").filter(Boolean);
    if (catList.length > 0) {
      where.categoriaProfesional = { in: catList };
    }
  }

  // Search across worker name, CUIL, and periodo
  if (search) {
    where.OR = [
      { periodo: { contains: search, mode: "insensitive" } },
      { categoriaProfesional: { contains: search, mode: "insensitive" } },
      { domesticWorker: { apellidoNombre: { contains: search, mode: "insensitive" } } },
      { domesticWorker: { cuil: { contains: search } } },
    ];
  }

  // Total amount range filter
  if (totalMin || totalMax) {
    where.total = {};
    if (totalMin) where.total.gte = new Prisma.Decimal(totalMin);
    if (totalMax) where.total.lte = new Prisma.Decimal(totalMax);
  }

  // Contribution amount range filter
  if (contribMin || contribMax) {
    where.contributionAmount = {};
    if (contribMin) where.contributionAmount.gte = new Prisma.Decimal(contribMin);
    if (contribMax) where.contributionAmount.lte = new Prisma.Decimal(contribMax);
  }

  const baseWhere: Prisma.DomesticReceiptWhereInput = { ...where };

  // Apply status filter at DB level (pre-pagination) via automationJobs relation
  if (statuses) {
    const statusList = statuses.split(",").filter(Boolean);
    if (statusList.length > 0) {
      const NO_JOB = "__NO_JOB__";
      const hasNoJob = statusList.includes(NO_JOB);
      const jobStatuses = statusList.filter((s) => s !== NO_JOB);

      const statusConditions: Prisma.DomesticReceiptWhereInput[] = [];
      if (jobStatuses.length > 0) {
        statusConditions.push({
          automationJobs: {
            some: {
              jobType: "SUBMIT_DOMESTIC_DEDUCTION",
              status: { in: jobStatuses as Prisma.EnumJobStatusFilter["in"] },
            },
          },
        });
      }
      if (hasNoJob) {
        statusConditions.push({
          automationJobs: { none: { jobType: "SUBMIT_DOMESTIC_DEDUCTION" } },
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
      { automationJobs: { none: { jobType: "SUBMIT_DOMESTIC_DEDUCTION" } } },
      { automationJobs: { some: { jobType: "SUBMIT_DOMESTIC_DEDUCTION", status: "FAILED" } } },
      { domesticWorkerId: null },
    ];
  }

  const [receipts, totalCount, distinctJobStatuses, receiptsWithoutJobs, distinctCategories] =
    await Promise.all([
      prisma.domesticReceipt.findMany({
        where,
        select: {
          id: true,
          domesticWorkerId: true,
          fiscalYear: true,
          fiscalMonth: true,
          periodo: true,
          categoriaProfesional: true,
          total: true,
          contributionAmount: true,
          source: true,
          siradiqStatus: true,
          originalFilename: true,
          fileMimeType: true,
          createdAt: true,
          domesticWorker: {
            select: { id: true, apellidoNombre: true, cuil: true },
          },
          automationJobs: {
            where: { jobType: "SUBMIT_DOMESTIC_DEDUCTION" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, createdAt: true, errorMessage: true },
          },
        },
        orderBy: [{ fiscalYear: "desc" }, { fiscalMonth: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.domesticReceipt.count({ where }),
      prisma.automationJob.groupBy({
        by: ["status"],
        where: {
          jobType: "SUBMIT_DOMESTIC_DEDUCTION",
          domesticReceipts: { some: { ...baseWhere } },
        },
      }),
      prisma.domesticReceipt.count({
        where: {
          ...baseWhere,
          automationJobs: { none: { jobType: "SUBMIT_DOMESTIC_DEDUCTION" } },
        },
      }),
      // Distinct categories across all matching receipts (for filter options)
      prisma.domesticReceipt.groupBy({
        by: ["categoriaProfesional"],
        where: { ...baseWhere, categoriaProfesional: { not: null } },
      }),
    ]);

  const result = receipts.map((r) => {
    const { automationJobs, ...rest } = r;
    return {
      ...rest,
      hasFile: !!r.fileMimeType,
      latestJob: automationJobs[0] ?? null,
    };
  });

  const availableStatuses: string[] = distinctJobStatuses.map((s) => s.status);
  if (receiptsWithoutJobs > 0) availableStatuses.push("__NO_JOB__");

  const availableCategories: string[] = distinctCategories
    .map((c) => c.categoriaProfesional)
    .filter((c): c is string => c !== null);

  return NextResponse.json({
    receipts: result,
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

  try {
    const body = await req.json();
    const { fileBase64, fileMimeType, originalFilename, ...receiptBody } = body;
    const parsed = createDomesticReceiptSchema.safeParse(receiptBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verify worker belongs to user if provided
    if (parsed.data.domesticWorkerId) {
      const worker = await prisma.domesticWorker.findFirst({
        where: { id: parsed.data.domesticWorkerId, userId: session.user.id },
      });
      if (!worker) {
        return NextResponse.json({ error: "Trabajador no encontrado" }, { status: 404 });
      }
    }

    const receipt = await prisma.domesticReceipt.create({
      data: {
        userId: session.user.id,
        domesticWorkerId: parsed.data.domesticWorkerId || null,
        fiscalYear: parsed.data.fiscalYear,
        fiscalMonth: parsed.data.fiscalMonth,
        periodo: parsed.data.periodo,
        categoriaProfesional: parsed.data.categoriaProfesional,
        modalidadPrestacion: parsed.data.modalidadPrestacion,
        horasSemanales: parsed.data.horasSemanales,
        modalidadLiquidacion: parsed.data.modalidadLiquidacion,
        totalHorasTrabajadas: parsed.data.totalHorasTrabajadas,
        basico: parsed.data.basico ? new Prisma.Decimal(parsed.data.basico) : null,
        antiguedad: parsed.data.antiguedad ? new Prisma.Decimal(parsed.data.antiguedad) : null,
        viaticos: parsed.data.viaticos ? new Prisma.Decimal(parsed.data.viaticos) : null,
        presentismo: parsed.data.presentismo ? new Prisma.Decimal(parsed.data.presentismo) : null,
        otros: parsed.data.otros ? new Prisma.Decimal(parsed.data.otros) : null,
        total: new Prisma.Decimal(parsed.data.total),
        paymentDetails: parsed.data.paymentDetails ?? undefined,
        contributionAmount: parsed.data.contributionAmount
          ? new Prisma.Decimal(parsed.data.contributionAmount)
          : null,
        contributionDate: parsed.data.contributionDate,
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

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    console.error("Error creating receipt:", error);
    return NextResponse.json({ error: "Error al crear recibo" }, { status: 500 });
  }
}
