import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog/posts";

const BASE_URL = "https://desgrava.ar";

// Captured once at module load. Stable across requests within a deploy —
// Google ignores `<lastmod>` values that change on every fetch.
const SITE_LAST_BUILT = new Date();

// Mirrors the `LAST_UPDATED` constants in the legal pages. Bump together when
// the legal copy changes.
const LAST_LEGAL_UPDATE = new Date("2026-05-01");

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: post.frontmatter.date,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const blogIndexLastModified =
    posts.length > 0
      ? new Date(Math.max(...posts.map((p) => p.frontmatter.date.getTime())))
      : SITE_LAST_BUILT;

  return [
    {
      url: `${BASE_URL}/`,
      lastModified: SITE_LAST_BUILT,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/simulador`,
      lastModified: SITE_LAST_BUILT,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/como-funciona`,
      lastModified: SITE_LAST_BUILT,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/planes`,
      lastModified: SITE_LAST_BUILT,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: blogIndexLastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/quienes-somos`,
      lastModified: SITE_LAST_BUILT,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    ...postEntries,
    {
      url: `${BASE_URL}/terminos`,
      lastModified: LAST_LEGAL_UPDATE,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacidad`,
      lastModified: LAST_LEGAL_UPDATE,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/cookies`,
      lastModified: LAST_LEGAL_UPDATE,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
