import { extractFields, ExtractedFields } from "./field-extractor";

export interface OcrResult {
  text: string;
  fields: ExtractedFields;
  method: "pdf-parse" | "tesseract";
}

interface TextItem {
  text: string;
  x: number;
  y: number;
}

/** Reconstruct readable text from positioned PDF text items (left-to-right, top-to-bottom). */
function buildTextFromLayout(items: TextItem[]): string {
  if (items.length === 0) return "";

  // Sort top-to-bottom (Y descending in PDF coords) then left-to-right (X ascending)
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 3) return yDiff;
    return a.x - b.x;
  });

  // Group items into lines by Y proximity
  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentLine[0].y) <= 3) {
      currentLine.push(sorted[i]);
    } else {
      lines.push(currentLine);
      currentLine = [sorted[i]];
    }
  }
  lines.push(currentLine);

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      return line.map((item) => item.text).join(" ");
    })
    .join("\n");
}

export async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  let text = "";
  let method: OcrResult["method"] = "pdf-parse";

  if (mimeType === "application/pdf") {
    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const doc = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
      }).promise;

      const pageTexts: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();

        const items: TextItem[] = (content.items as any[])
          .filter((item) => "str" in item && item.str.trim().length > 0)
          .map((item) => ({
            text: item.str.trim(),
            x: item.transform[4],
            y: item.transform[5],
          }));

        pageTexts.push(buildTextFromLayout(items));
      }

      text = pageTexts.join("\n\n");

      if (text.trim().length > 50) {
        const fields = extractFields(text);
        return { text, fields, method: "pdf-parse" };
      }
    } catch (e) {
      console.warn("PDF text extraction failed, falling back to OCR:", e);
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
