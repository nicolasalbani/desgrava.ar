import { describe, it, expect } from "vitest";
import { buildParams, type Filters } from "@/hooks/use-paginated-fetch";

describe("buildParams", () => {
  it("includes page and pageSize in the query string", () => {
    const qs = buildParams(1, 25, "", undefined, {});
    const params = new URLSearchParams(qs);
    expect(params.get("page")).toBe("1");
    expect(params.get("pageSize")).toBe("25");
  });

  it("includes search when provided", () => {
    const qs = buildParams(1, 25, "hello", undefined, {});
    const params = new URLSearchParams(qs);
    expect(params.get("search")).toBe("hello");
  });

  it("omits search when empty", () => {
    const qs = buildParams(1, 25, "", undefined, {});
    const params = new URLSearchParams(qs);
    expect(params.has("search")).toBe(false);
  });

  it("includes staticParams", () => {
    const qs = buildParams(1, 25, "", { fiscalYear: "2025", status: "active" }, {});
    const params = new URLSearchParams(qs);
    expect(params.get("fiscalYear")).toBe("2025");
    expect(params.get("status")).toBe("active");
  });

  it("omits undefined staticParams", () => {
    const qs = buildParams(1, 25, "", { fiscalYear: undefined, status: "active" }, {});
    const params = new URLSearchParams(qs);
    expect(params.has("fiscalYear")).toBe(false);
    expect(params.get("status")).toBe("active");
  });

  it("omits empty string staticParams", () => {
    const qs = buildParams(1, 25, "", { fiscalYear: "" }, {});
    const params = new URLSearchParams(qs);
    expect(params.has("fiscalYear")).toBe(false);
  });

  it("includes string filter values", () => {
    const filters: Filters = { category: "GASTOS_MEDICOS", amountMin: "100" };
    const qs = buildParams(1, 25, "", undefined, filters);
    const params = new URLSearchParams(qs);
    expect(params.get("category")).toBe("GASTOS_MEDICOS");
    expect(params.get("amountMin")).toBe("100");
  });

  it("omits undefined filter values", () => {
    const filters: Filters = { present: "yes", absent: undefined };
    const qs = buildParams(1, 25, "", undefined, filters);
    const params = new URLSearchParams(qs);
    expect(params.get("present")).toBe("yes");
    expect(params.has("absent")).toBe(false);
  });

  it("omits empty string filter values", () => {
    const filters: Filters = { category: "" };
    const qs = buildParams(1, 25, "", undefined, filters);
    const params = new URLSearchParams(qs);
    expect(params.has("category")).toBe(false);
  });

  it("serializes array filter values as comma-separated", () => {
    const filters: Filters = { tags: ["a", "b", "c"] };
    const qs = buildParams(1, 25, "", undefined, filters);
    const params = new URLSearchParams(qs);
    expect(params.get("tags")).toBe("a,b,c");
  });

  it("omits empty array filter values", () => {
    const filters: Filters = { tags: [] };
    const qs = buildParams(1, 25, "", undefined, filters);
    const params = new URLSearchParams(qs);
    expect(params.has("tags")).toBe(false);
  });

  it("combines all params correctly", () => {
    const filters: Filters = {
      categories: ["A", "B"],
      amountMin: "500",
      empty: undefined,
    };
    const qs = buildParams(2, 50, "test", { fiscalYear: "2025" }, filters);
    const params = new URLSearchParams(qs);
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("50");
    expect(params.get("search")).toBe("test");
    expect(params.get("fiscalYear")).toBe("2025");
    expect(params.get("categories")).toBe("A,B");
    expect(params.get("amountMin")).toBe("500");
    expect(params.has("empty")).toBe(false);
  });

  it("handles different page numbers", () => {
    const qs = buildParams(5, 10, "", undefined, {});
    const params = new URLSearchParams(qs);
    expect(params.get("page")).toBe("5");
    expect(params.get("pageSize")).toBe("10");
  });

  it("does not conflict between staticParams and filters with same key", () => {
    // filters should override staticParams since they're set after
    const qs = buildParams(1, 25, "", { key: "static" }, { key: "filter" });
    const params = new URLSearchParams(qs);
    // URLSearchParams.set overwrites, so last write wins
    expect(params.get("key")).toBe("filter");
  });

  it("handles special characters in search", () => {
    const qs = buildParams(1, 25, "café & más", undefined, {});
    const params = new URLSearchParams(qs);
    expect(params.get("search")).toBe("café & más");
  });

  it("handles special characters in filter values", () => {
    const filters: Filters = { name: "O'Brien & Co." };
    const qs = buildParams(1, 25, "", undefined, filters);
    const params = new URLSearchParams(qs);
    expect(params.get("name")).toBe("O'Brien & Co.");
  });
});
