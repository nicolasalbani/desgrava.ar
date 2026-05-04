import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";
import { blogFrontmatterSchema, type BlogFrontmatter } from "./schema";

export interface BlogPost {
  slug: string;
  frontmatter: BlogFrontmatter;
  content: string;
  readingTimeMinutes: number;
}

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

function readPostFile(filename: string): BlogPost {
  const filePath = path.join(BLOG_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(raw);
  const frontmatter = blogFrontmatterSchema.parse(parsed.data);
  const fileSlug = filename.replace(/\.mdx$/, "");
  if (frontmatter.slug !== fileSlug) {
    throw new Error(
      `Blog post ${filename}: frontmatter slug "${frontmatter.slug}" does not match filename`,
    );
  }
  const stats = readingTime(parsed.content);
  return {
    slug: frontmatter.slug,
    frontmatter,
    content: parsed.content,
    readingTimeMinutes: Math.max(1, Math.ceil(stats.minutes)),
  };
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  return files
    .map(readPostFile)
    .sort((a, b) => b.frontmatter.date.getTime() - a.frontmatter.date.getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  return readPostFile(`${slug}.mdx`);
}

export function formatBlogDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
