import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/storage/supabase-storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;

  const presentacion = await prisma.presentacion.findFirst({
    where: { id, userId: session.user.id },
    select: { fileStorageKey: true },
  });

  if (!presentacion?.fileStorageKey) {
    return new Response("Archivo no encontrado", { status: 404 });
  }

  const signedUrl = await getSignedUrl(presentacion.fileStorageKey, 60);
  return NextResponse.redirect(signedUrl, 302);
}
