import { extractFields, ExtractedFields } from "./field-extractor";

export interface OcrResult {
  text: string;
  fields: ExtractedFields;
  method: "pdf-parse" | "tesseract";
}

// pdfjs-dist (used internally by pdf-parse) expects browser globals for rendering.
// We only need text extraction, so stub them out in serverless environments.
function ensurePdfjsPolyfills() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") {
    g.DOMMatrix = class DOMMatrix {
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      is2D = true; isIdentity = true;
    } as unknown;
  }
  if (typeof g.ImageData === "undefined") {
    g.ImageData = class ImageData {
      width = 0; height = 0;
      data = new Uint8ClampedArray(0);
      constructor(w: number, h: number) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
    } as unknown;
  }
  if (typeof g.Path2D === "undefined") {
    g.Path2D = class Path2D {} as unknown;
  }
}

export async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  if (mimeType === "application/pdf") {
    try {
      ensurePdfjsPolyfills();
      const { PDFParse } = await import("pdf-parse");
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
