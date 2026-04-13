import { describe, it, expect } from "vitest";
import { profileUpdateSchema } from "@/lib/validators/profile";

describe("profileUpdateSchema", () => {
  describe("name field", () => {
    it("accepts a valid name", () => {
      const result = profileUpdateSchema.safeParse({ name: "Juan Pérez" });
      expect(result.success).toBe(true);
    });

    it("rejects an empty name", () => {
      const result = profileUpdateSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects a name over 100 characters", () => {
      const result = profileUpdateSchema.safeParse({ name: "a".repeat(101) });
      expect(result.success).toBe(false);
    });

    it("accepts a name at exactly 100 characters", () => {
      const result = profileUpdateSchema.safeParse({ name: "a".repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe("image field", () => {
    it("accepts a valid data URL", () => {
      const result = profileUpdateSchema.safeParse({
        image: "data:image/jpeg;base64,/9j/small",
      });
      expect(result.success).toBe(true);
    });

    it("rejects a non-data-URL string", () => {
      const result = profileUpdateSchema.safeParse({
        image: "https://example.com/photo.jpg",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a data URL over 500KB", () => {
      const largePayload = "data:image/jpeg;base64," + "A".repeat(500 * 1024);
      const result = profileUpdateSchema.safeParse({ image: largePayload });
      expect(result.success).toBe(false);
    });

    it("accepts a data URL just under 500KB", () => {
      // "data:image/jpeg;base64," is 23 chars, so remaining budget is 500*1024 - 23
      const payload = "data:image/jpeg;base64," + "A".repeat(500 * 1024 - 100);
      const result = profileUpdateSchema.safeParse({ image: payload });
      expect(result.success).toBe(true);
    });
  });

  describe("overall schema", () => {
    it("rejects an empty object (no fields)", () => {
      const result = profileUpdateSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts name only", () => {
      const result = profileUpdateSchema.safeParse({ name: "María" });
      expect(result.success).toBe(true);
    });

    it("accepts image only", () => {
      const result = profileUpdateSchema.safeParse({
        image: "data:image/png;base64,abc123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts both name and image", () => {
      const result = profileUpdateSchema.safeParse({
        name: "Carlos",
        image: "data:image/jpeg;base64,abc",
      });
      expect(result.success).toBe(true);
    });
  });
});
