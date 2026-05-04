import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxComponents } from "@/../mdx-components";
import { BlogPostCta } from "@/components/blog/blog-post-cta";
import { formatBlogDate, getAllPosts, getPostBySlug } from "@/lib/blog/posts";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const { frontmatter } = post;
  const url = `https://desgrava.ar/blog/${frontmatter.slug}`;
  const title = frontmatter.ogTitle ?? frontmatter.title;
  const description = frontmatter.ogDescription ?? frontmatter.description;
  return {
    title: `${frontmatter.title} · desgrava.ar`,
    description: frontmatter.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      publishedTime: frontmatter.date.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

function ArticleJsonLd({
  slug,
  title,
  description,
  date,
}: {
  slug: string;
  title: string;
  description: string;
  date: Date;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished: date.toISOString(),
    inLanguage: "es-AR",
    articleSection: "Blog",
    publisher: {
      "@type": "Organization",
      name: "desgrava.ar",
      url: "https://desgrava.ar",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://desgrava.ar/blog/${slug}`,
    },
  };
  return (
    <Script
      id={`blog-article-jsonld-${slug}`}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { frontmatter, content, readingTimeMinutes } = post;

  return (
    <div className="bg-background overflow-x-hidden">
      <ArticleJsonLd
        slug={frontmatter.slug}
        title={frontmatter.title}
        description={frontmatter.description}
        date={frontmatter.date}
      />

      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-6 md:px-6 md:pt-16 md:pb-8">
          <h1 className="text-foreground text-3xl leading-tight font-bold tracking-tight break-words md:text-5xl md:leading-tight">
            {frontmatter.title}
          </h1>
          <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <time dateTime={frontmatter.date.toISOString()}>
              {formatBlogDate(frontmatter.date)}
            </time>
            <span aria-hidden>·</span>
            <span>{readingTimeMinutes} min de lectura</span>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-14">
          <article className="prose prose-neutral dark:prose-invert max-w-none">
            <MDXRemote source={content} components={mdxComponents} />
          </article>
          <BlogPostCta />
        </div>
      </section>
    </div>
  );
}
