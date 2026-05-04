import { describe, it, expect } from "vitest";
import { blogFrontmatterSchema } from "@/lib/blog/schema";

describe("blogFrontmatterSchema", () => {
  it("parses a valid frontmatter object", () => {
    const result = blogFrontmatterSchema.parse({
      slug: "que-es-desgrava",
      title: "¿Qué es desgrava.ar?",
      description: "Una descripción.",
      date: "2026-02-10",
    });
    expect(result.slug).toBe("que-es-desgrava");
    expect(result.title).toBe("¿Qué es desgrava.ar?");
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date.toISOString().slice(0, 10)).toBe("2026-02-10");
  });

  it("accepts a Date object as date", () => {
    const result = blogFrontmatterSchema.parse({
      slug: "post",
      title: "T",
      description: "D",
      date: new Date("2026-03-15"),
    });
    expect(result.date.toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("rejects missing slug", () => {
    expect(() =>
      blogFrontmatterSchema.parse({
        title: "T",
        description: "D",
        date: "2026-02-10",
      }),
    ).toThrow();
  });

  it("rejects slug with invalid characters", () => {
    expect(() =>
      blogFrontmatterSchema.parse({
        slug: "Que es Desgrava!",
        title: "T",
        description: "D",
        date: "2026-02-10",
      }),
    ).toThrow();
  });

  it("rejects empty title", () => {
    expect(() =>
      blogFrontmatterSchema.parse({
        slug: "post",
        title: "",
        description: "D",
        date: "2026-02-10",
      }),
    ).toThrow();
  });

  it("rejects missing description", () => {
    expect(() =>
      blogFrontmatterSchema.parse({
        slug: "post",
        title: "T",
        date: "2026-02-10",
      }),
    ).toThrow();
  });

  it("rejects invalid date string", () => {
    expect(() =>
      blogFrontmatterSchema.parse({
        slug: "post",
        title: "T",
        description: "D",
        date: "not-a-date",
      }),
    ).toThrow();
  });

  it("accepts optional ogTitle and ogDescription", () => {
    const result = blogFrontmatterSchema.parse({
      slug: "post",
      title: "T",
      description: "D",
      date: "2026-02-10",
      ogTitle: "Custom OG title",
      ogDescription: "Custom OG description",
    });
    expect(result.ogTitle).toBe("Custom OG title");
    expect(result.ogDescription).toBe("Custom OG description");
  });
});
