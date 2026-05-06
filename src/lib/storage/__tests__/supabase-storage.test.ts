import { describe, it, expect } from "vitest";
import { STORAGE_BUCKET, buildStorageKey, inferExtension } from "@/lib/storage/supabase-storage";

describe("STORAGE_BUCKET", () => {
  it("is 'comprobantes' (the canonical private bucket name)", () => {
    expect(STORAGE_BUCKET).toBe("comprobantes");
  });
});

describe("buildStorageKey", () => {
  it("formats <userId>/<recordId>.<ext>", () => {
    expect(buildStorageKey("user123", "rec456", "pdf")).toBe("user123/rec456.pdf");
  });

  it("strips leading dots from the extension", () => {
    expect(buildStorageKey("u", "r", ".pdf")).toBe("u/r.pdf");
    expect(buildStorageKey("u", "r", "..pdf")).toBe("u/r.pdf");
  });

  it("lowercases the extension", () => {
    expect(buildStorageKey("u", "r", "PDF")).toBe("u/r.pdf");
    expect(buildStorageKey("u", "r", "JPG")).toBe("u/r.jpg");
  });
});

describe("inferExtension", () => {
  it("uses the original filename's extension when available", () => {
    expect(inferExtension("invoice.pdf", "application/pdf")).toBe("pdf");
    expect(inferExtension("recibo_2025.PDF", null)).toBe("pdf");
  });

  it("lowercases the extension from the filename", () => {
    expect(inferExtension("FOO.PNG", null)).toBe("png");
  });

  it("derives from mime type when filename has no extension", () => {
    expect(inferExtension("noextension", "application/pdf")).toBe("pdf");
    expect(inferExtension(null, "image/jpeg")).toBe("jpg");
    expect(inferExtension(null, "image/png")).toBe("png");
    expect(inferExtension(null, "image/webp")).toBe("webp");
  });

  it("normalizes mime-type case", () => {
    expect(inferExtension(null, "Application/PDF")).toBe("pdf");
  });

  it("falls back to 'bin' when neither filename nor mime type are useful", () => {
    expect(inferExtension(null, null)).toBe("bin");
    expect(inferExtension("", "")).toBe("bin");
    expect(inferExtension("noextension", "application/x-unknown")).toBe("bin");
  });

  it("ignores filenames that end in a dot", () => {
    // "foo." has a dot but no extension after it.
    expect(inferExtension("foo.", "application/pdf")).toBe("pdf");
  });

  it("handles compound extensions by taking the last segment", () => {
    expect(inferExtension("backup.tar.gz", null)).toBe("gz");
  });
});
