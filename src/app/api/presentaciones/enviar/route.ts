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
    const { fiscalYear } = body;

    if (!fiscalYear) {
      return NextResponse.json({ error: "Falta el año fiscal" }, { status: 400 });
    }

    // Prevent concurrent submit jobs
    const activeJob = await prisma.automationJob.findFirst({
      where: {
        userId: session.user.id,
        jobType: "SUBMIT_PRESENTACION",
        status: { in: ["PENDING", "RUNNING"] },
      },
    });
    if (activeJob) {
      return NextResponse.json(
        { error: "Ya hay un envío de presentación en curso" },
        { status: 409 },
      );
    }

    const job = await prisma.automationJob.create({
      data: {
        userId: session.user.id,
        jobType: "SUBMIT_PRESENTACION",
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
  } catch (error) {
    console.error("Error creating submit job:", error);
    return NextResponse.json({ error: "Error al crear job de envío" }, { status: 500 });
  }
}
