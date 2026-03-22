import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const where = {
    userId: session.user.id,
    ...(fiscalYear ? { fiscalYear: parseInt(fiscalYear) } : {}),
  };

  const [presentaciones, totalCount] = await Promise.all([
    prisma.presentacion.findMany({
      where,
      select: {
        id: true,
        fiscalYear: true,
        numero: true,
        descripcion: true,
        fechaEnvio: true,
        fechaLectura: true,
        montoTotal: true,
        source: true,
        siradiqStatus: true,
        fileMimeType: true,
        originalFilename: true,
        createdAt: true,
        automationJobs: {
          where: {
            jobType: { in: ["PULL_PRESENTACIONES", "SUBMIT_PRESENTACION"] },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            createdAt: true,
            errorMessage: true,
          },
        },
      },
      orderBy: { numero: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.presentacion.count({ where }),
  ]);

  const result = presentaciones.map((p) => {
    const { automationJobs, ...rest } = p;
    return {
      ...rest,
      hasFile: !!p.fileMimeType,
      latestJob: automationJobs[0] ?? null,
    };
  });

  return NextResponse.json({
    presentaciones: result,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  });
}
