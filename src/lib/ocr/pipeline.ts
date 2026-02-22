import { extractFields, ExtractedFields } from "./field-extractor";
import { PDFParse } from "pdf-parse";

export interface OcrResult {
  text: string;
  fields: ExtractedFields;
  method: "pdf-parse" | "tesseract";
}

export async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  if (mimeType === "application/pdf") {
    try {
      const parser = new PDFParse({ verbosity: 0, data: buffer });
      const result = await parser.getText();
      const text = result.pages.map((p: { text: string }) => p.text).join("\n\n");

      if (text.trim().length > 50) {
        const fields = extractFields(text);
        return { text, fields, method: "pdf-parse" };
      }
    } catch (e) {
      console.warn("PDF text extraction failed:", e);
    }
  }

  // Tesseract OCR fallback — only works in non-serverless environments
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("spa");

    let text = "";
    if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
      const result = await worker.recognize(buffer);
      text = result.data.text;
    }

    await worker.terminate();
    const fields = extractFields(text);
    return { text, fields, method: "tesseract" };
  } catch (e) {
    console.error("Tesseract OCR failed:", e);
    throw new Error(
      "No se pudo procesar el documento. Asegurate de subir un PDF con texto (no escaneado)."
    );
  }
}
