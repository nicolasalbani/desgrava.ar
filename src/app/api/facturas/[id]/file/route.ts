import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: session.user.id },
    select: { fileData: true, fileMimeType: true, originalFilename: true },
  });

  if (!invoice || !invoice.fileData) {
    return new Response("Archivo no encontrado", { status: 404 });
  }

  const filename = invoice.originalFilename ?? `factura-${id}`;

  return new Response(invoice.fileData, {
    headers: {
      "Content-Type": invoice.fileMimeType ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
