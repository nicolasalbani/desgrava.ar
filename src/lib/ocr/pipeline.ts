import { extractFields, ExtractedFields } from "./field-extractor";

export interface OcrResult {
  text: string;
  fields: ExtractedFields;
  method: "pdf-parse" | "tesseract";
}

export async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  let text = "";
  let method: OcrResult["method"] = "pdf-parse";

  if (mimeType === "application/pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
      await parser.load();
      const result = await parser.getText();
      text = result.text;

      if (text.trim().length > 50) {
        const fields = extractFields(text);
        return { text, fields, method: "pdf-parse" };
      }
    } catch (e) {
      console.warn("pdf-parse failed, falling back to OCR:", e);
    }
  }

  method = "tesseract";
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("spa");

    if (mimeType.startsWith("image/") || mimeType === "application/pdf") {
      const result = await worker.recognize(buffer);
      text = result.data.text;
    }

    await worker.terminate();
  } catch (e) {
    console.error("Tesseract OCR failed:", e);
    throw new Error("No se pudo procesar el documento");
  }

  const fields = extractFields(text);
  return { text, fields, method };
}
