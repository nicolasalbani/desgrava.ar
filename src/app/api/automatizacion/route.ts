import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processJob } from "@/lib/automation/job-processor";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { invoiceId, jobType = "SUBMIT_INVOICE" } = body;

    // Verify invoice belongs to user
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, userId: session.user.id },
      });
      if (!invoice) {
        return NextResponse.json(
          { error: "Factura no encontrada" },
          { status: 404 }
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

    // Process in background — after() keeps the function alive after the response is sent
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
    return NextResponse.json(
      { error: "Error al crear job" },
      { status: 500 }
    );
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
          amount: true,
          fiscalMonth: true,
          fiscalYear: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ jobs });
}
