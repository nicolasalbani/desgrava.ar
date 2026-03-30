import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processDocument } from "@/lib/ocr/pipeline";
import { extractReceiptFields } from "@/lib/ocr/receipt-extractor";
import { requireWriteAccess } from "@/lib/subscription/require-write-access";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const denied = await requireWriteAccess(session.user.id);
  if (denied) return denied;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibio ningun archivo" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no soportado. Usa PDF, JPG, PNG o WebP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "El archivo excede el limite de 10MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await processDocument(buffer, file.type);
    const receiptFields = extractReceiptFields(result.text);

    return NextResponse.json({
      filename: file.name,
      mimeType: file.type,
      fileBase64: buffer.toString("base64"),
      method: result.method,
      extractedFields: receiptFields,
      rawTextPreview: result.text.substring(0, 500),
    });
  } catch (error) {
    console.error("Error processing receipt upload:", error);
    return NextResponse.json({ error: "Error al procesar el archivo" }, { status: 500 });
  }
}
