import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processJob } from "@/lib/automation/job-processor";
import { requireWriteAccess } from "@/lib/subscription/require-write-access";
import { isFiscalYearReadOnly } from "@/lib/fiscal-year";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const denied = await requireWriteAccess(session.user.id);
  if (denied) return denied;

  try {
    const body = await req.json();
    const {
      invoiceId,
      jobType = "SUBMIT_INVOICE",
      fiscalYear,
      familyDependentId,
      employerId,
    } = body;

    // Reject jobs for read-only fiscal years (after March 31st cutoff)
    if (fiscalYear && isFiscalYearReadOnly(fiscalYear)) {
      return NextResponse.json(
        { error: `El período fiscal ${fiscalYear} ya no está disponible en SiRADIG` },
        { status: 400 },
      );
    }

    // PULL_COMPROBANTES: import invoices from ARCA's "Mis Comprobantes"
    if (jobType === "PULL_COMPROBANTES") {
      if (!fiscalYear) {
        return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
      }

      // Prevent concurrent pull jobs
      const activeJob = await prisma.automationJob.findFirst({
        where: {
          userId: session.user.id,
          jobType: "PULL_COMPROBANTES",
          status: { in: ["PENDING", "RUNNING"] },
        },
      });
      if (activeJob) {
        return NextResponse.json(
          { error: "Ya hay una importación de comprobantes en curso" },
          { status: 409 },
        );
      }

      const job = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType,
          fiscalYear,
          status: "PENDING",
        },
      });

      after(async () => {
        try {
          await processJob(job.id);
        } catch (err) {
          console.error("Job processing error:", err);
        }
      });

      return NextResponse.json({ job }, { status: 201 });
    }

    // PULL_FAMILY_DEPENDENTS doesn't need an invoice
    if (jobType === "PULL_FAMILY_DEPENDENTS") {
      if (!fiscalYear) {
        return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
      }

      const job = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType,
          fiscalYear,
          status: "PENDING",
        },
      });

      after(async () => {
        try {
          await processJob(job.id);
        } catch (err) {
          console.error("Job processing error:", err);
        }
      });

      return NextResponse.json({ job }, { status: 201 });
    }

    // PUSH_FAMILY_DEPENDENTS: requires familyDependentId (individual export)
    if (jobType === "PUSH_FAMILY_DEPENDENTS") {
      if (!fiscalYear) {
        return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
      }
      if (!familyDependentId) {
        return NextResponse.json({ error: "Falta el ID de la carga de familia" }, { status: 400 });
      }

      // Verify the dependent exists and belongs to the user
      const dependent = await prisma.familyDependent.findFirst({
        where: { id: familyDependentId, userId: session.user.id, fiscalYear },
      });
      if (!dependent) {
        return NextResponse.json({ error: "Carga de familia no encontrada" }, { status: 404 });
      }

      // Prevent concurrent push jobs for the same dependent
      const activeJob = await prisma.automationJob.findFirst({
        where: {
          userId: session.user.id,
          jobType: "PUSH_FAMILY_DEPENDENTS",
          familyDependentId,
          status: { in: ["PENDING", "RUNNING"] },
        },
      });
      if (activeJob) {
        return NextResponse.json(
          { error: "Ya hay una exportación en curso para esta carga de familia" },
          { status: 409 },
        );
      }

      const job = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType,
          fiscalYear,
          familyDependentId,
          status: "PENDING",
        },
      });

      after(async () => {
        try {
          await processJob(job.id);
        } catch (err) {
          console.error("Job processing error:", err);
        }
      });

      return NextResponse.json({ job }, { status: 201 });
    }

    // PULL_PERSONAL_DATA: import personal data from SiRADIG
    if (jobType === "PULL_PERSONAL_DATA") {
      if (!fiscalYear) {
        return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
      }

      const job = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType,
          fiscalYear,
          status: "PENDING",
        },
      });

      after(async () => {
        try {
          await processJob(job.id);
        } catch (err) {
          console.error("Job processing error:", err);
        }
      });

      return NextResponse.json({ job }, { status: 201 });
    }

    // PULL_EMPLOYERS: import employers from SiRADIG
    if (jobType === "PULL_EMPLOYERS") {
      if (!fiscalYear) {
        return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
      }

      const job = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType,
          fiscalYear,
          status: "PENDING",
        },
      });

      after(async () => {
        try {
          await processJob(job.id);
        } catch (err) {
          console.error("Job processing error:", err);
        }
      });

      return NextResponse.json({ job }, { status: 201 });
    }

    // PUSH_EMPLOYERS: export individual employer to SiRADIG
    if (jobType === "PUSH_EMPLOYERS") {
      if (!fiscalYear) {
        return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
      }
      if (!employerId) {
        return NextResponse.json({ error: "Falta el ID del empleador" }, { status: 400 });
      }

      const employer = await prisma.employer.findFirst({
        where: { id: employerId, userId: session.user.id, fiscalYear },
      });
      if (!employer) {
        return NextResponse.json({ error: "Empleador no encontrado" }, { status: 404 });
      }

      const activeJob = await prisma.automationJob.findFirst({
        where: {
          userId: session.user.id,
          jobType: "PUSH_EMPLOYERS",
          employerId,
          status: { in: ["PENDING", "RUNNING"] },
        },
      });
      if (activeJob) {
        return NextResponse.json(
          { error: "Ya hay una exportación en curso para este empleador" },
          { status: 409 },
        );
      }

      const job = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType,
          fiscalYear,
          employerId,
          status: "PENDING",
        },
      });

      after(async () => {
        try {
          await processJob(job.id);
        } catch (err) {
          console.error("Job processing error:", err);
        }
      });

      return NextResponse.json({ job }, { status: 201 });
    }

    // PULL_DOMESTIC_WORKERS: import only worker data from ARCA "Personal de Casas Particulares"
    if (jobType === "PULL_DOMESTIC_WORKERS") {
      if (!fiscalYear) {
        return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
      }

      const activeJob = await prisma.automationJob.findFirst({
        where: {
          userId: session.user.id,
          jobType: { in: ["PULL_DOMESTIC_WORKERS", "PULL_DOMESTIC_RECEIPTS"] },
          status: { in: ["PENDING", "RUNNING"] },
        },
      });
      if (activeJob) {
        return NextResponse.json(
          { error: "Ya hay una importación de trabajadores domésticos en curso" },
          { status: 409 },
        );
      }

      const job = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType,
          fiscalYear,
          status: "PENDING",
        },
      });

      after(async () => {
        try {
          await processJob(job.id);
        } catch (err) {
          console.error("Job processing error:", err);
        }
      });

      return NextResponse.json({ job }, { status: 201 });
    }

    // PULL_DOMESTIC_RECEIPTS: import workers and receipts from ARCA "Personal de Casas Particulares"
    if (jobType === "PULL_DOMESTIC_RECEIPTS") {
      if (!fiscalYear) {
        return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
      }

      // Prevent concurrent pull jobs
      const activeJob = await prisma.automationJob.findFirst({
        where: {
          userId: session.user.id,
          jobType: "PULL_DOMESTIC_RECEIPTS",
          status: { in: ["PENDING", "RUNNING"] },
        },
      });
      if (activeJob) {
        return NextResponse.json(
          { error: "Ya hay una importación de recibos domésticos en curso" },
          { status: 409 },
        );
      }

      const job = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType,
          fiscalYear,
          status: "PENDING",
        },
      });

      after(async () => {
        try {
          await processJob(job.id);
        } catch (err) {
          console.error("Job processing error:", err);
        }
      });

      return NextResponse.json({ job }, { status: 201 });
    }

    // SUBMIT_DOMESTIC_DEDUCTION: submit domestic worker deduction to SiRADIG
    if (jobType === "SUBMIT_DOMESTIC_DEDUCTION") {
      if (!fiscalYear) {
        return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
      }

      // Accept optional receiptIds to limit which receipts are submitted
      const receiptIds: string[] | undefined = body.receiptIds;

      const job = await prisma.automationJob.create({
        data: {
          userId: session.user.id,
          jobType,
          fiscalYear,
          status: "PENDING",
          ...(receiptIds ? { resultData: { receiptIds } } : {}),
          ...(receiptIds
            ? {
                domesticReceipts: {
                  connect: receiptIds.map((id) => ({ id })),
                },
              }
            : {}),
        },
      });

      // Update receipt statuses to QUEUED
      if (receiptIds?.length) {
        await prisma.domesticReceipt.updateMany({
          where: { id: { in: receiptIds }, userId: session.user.id },
          data: { siradiqStatus: "QUEUED" },
        });
      }

      after(async () => {
        try {
          await processJob(job.id);
        } catch (err) {
          console.error("Job processing error:", err);
        }
      });

      return NextResponse.json({ job }, { status: 201 });
    }

    // Verify invoice belongs to user
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, userId: session.user.id },
      });
      if (!invoice) {
        return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
      }

      // Prevent submitting education invoices without a linked dependent
      if (invoice.deductionCategory === "GASTOS_EDUCATIVOS" && !invoice.familyDependentId) {
        return NextResponse.json(
          {
            error:
              "Los gastos educativos requieren un familiar vinculado antes de enviar a SiRADIG",
          },
          { status: 400 },
        );
      }

      // Prevent submitting rent invoices without contract dates
      if (
        invoice.deductionCategory === "ALQUILER_VIVIENDA" &&
        (!invoice.contractStartDate || !invoice.contractEndDate)
      ) {
        return NextResponse.json(
          {
            error:
              "Las deducciones de alquiler requieren las fechas de vigencia del contrato (desde y hasta) antes de enviar a SiRADIG",
          },
          { status: 400 },
        );
      }

      // Prevent submitting invoices for future months
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      if (
        invoice.fiscalYear > currentYear ||
        (invoice.fiscalYear === currentYear && invoice.fiscalMonth > currentMonth)
      ) {
        return NextResponse.json(
          { error: "No se pueden enviar comprobantes de periodos futuros a SiRADIG" },
          { status: 400 },
        );
      }

      // Update invoice status
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { siradiqStatus: "QUEUED" },
      });
    }

    const job = await prisma.automationJob.create({
      data: {
        userId: session.user.id,
        invoiceId,
        jobType,
        status: "PENDING",
      },
    });

    // Run in background after response is sent.
    // processJob uses prismaDirectClient (direct PG, not Accelerate)
    // so it won't hit P6000 connection errors.
    after(async () => {
      try {
        await processJob(job.id);
      } catch (err) {
        console.error("Job processing error:", err);
      }
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error("Error creating job:", error);
    return NextResponse.json({ error: "Error al crear job" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const jobs = await prisma.automationJob.findMany({
    where: { userId: session.user.id },
    include: {
      invoice: {
        select: {
          deductionCategory: true,
          providerCuit: true,
          providerName: true,
          invoiceType: true,
          amount: true,
          invoiceNumber: true,
          invoiceDate: true,
          fiscalMonth: true,
          fiscalYear: true,
          source: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ jobs });
}
