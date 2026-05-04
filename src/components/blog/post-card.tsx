import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatBlogDate, type BlogPost } from "@/lib/blog/posts";

interface PostCardProps {
  post: BlogPost;
}

export function PostCard({ post }: PostCardProps) {
  const { slug, frontmatter, readingTimeMinutes } = post;
  return (
    <article className="border-border border-b py-8 md:py-10">
      <Link href={`/blog/${slug}`} className="group block">
        <h2 className="text-foreground group-hover:text-primary text-2xl font-bold tracking-tight transition-colors md:text-3xl">
          {frontmatter.title}
        </h2>
        <p className="text-muted-foreground mt-3 text-base leading-relaxed">
          {frontmatter.description}
        </p>
        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <time dateTime={frontmatter.date.toISOString()}>{formatBlogDate(frontmatter.date)}</time>
          <span aria-hidden>·</span>
          <span>{readingTimeMinutes} min de lectura</span>
        </div>
        <span className="text-primary mt-4 inline-flex items-center gap-1.5 text-sm font-medium">
          Leer artículo
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </article>
  );
}
