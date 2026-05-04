import { describe, it, expect } from "vitest";
import { getAllPosts, getPostBySlug, formatBlogDate } from "@/lib/blog/posts";

describe("getAllPosts", () => {
  it("returns posts sorted by date descending", () => {
    const posts = getAllPosts();
    expect(posts.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < posts.length - 1; i++) {
      expect(posts[i].frontmatter.date.getTime()).toBeGreaterThanOrEqual(
        posts[i + 1].frontmatter.date.getTime(),
      );
    }
  });

  it("includes the launch posts", () => {
    const slugs = getAllPosts().map((p) => p.slug);
    expect(slugs).toContain("que-es-desgrava");
    expect(slugs).toContain("como-funciona-desgrava");
  });

  it("computes a positive readingTimeMinutes for each post", () => {
    for (const post of getAllPosts()) {
      expect(post.readingTimeMinutes).toBeGreaterThan(0);
      expect(Number.isInteger(post.readingTimeMinutes)).toBe(true);
    }
  });
});

describe("getPostBySlug", () => {
  it("returns the post for a known slug", () => {
    const post = getPostBySlug("que-es-desgrava");
    expect(post).not.toBeNull();
    expect(post?.frontmatter.title).toMatch(/desgrava/i);
  });

  it("returns null for an unknown slug", () => {
    expect(getPostBySlug("does-not-exist")).toBeNull();
  });

  it("includes parsed content (no frontmatter delimiters)", () => {
    const post = getPostBySlug("que-es-desgrava");
    expect(post?.content).not.toMatch(/^---/);
    expect(post?.content.length).toBeGreaterThan(100);
  });
});

describe("formatBlogDate", () => {
  it("formats dates in es-AR locale", () => {
    const formatted = formatBlogDate(new Date("2026-02-10T12:00:00Z"));
    expect(formatted).toMatch(/febrero/);
    expect(formatted).toMatch(/2026/);
  });
});
