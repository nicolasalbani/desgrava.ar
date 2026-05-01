import { describe, it, expect } from "vitest";
import { sectionLinks } from "@/lib/landing/section-links";

describe("sectionLinks", () => {
  it("exposes the three landing sections in order", () => {
    expect(sectionLinks.map((l) => l.label)).toEqual(["Cómo funciona", "Simulador", "Planes"]);
  });

  it("uses anchor hrefs that resolve from any route", () => {
    for (const link of sectionLinks) {
      expect(link.href.startsWith("/#")).toBe(true);
    }
  });

  it("attaches a lucide icon component to every entry", () => {
    for (const link of sectionLinks) {
      expect(typeof link.icon).toBe("object");
    }
  });
});
