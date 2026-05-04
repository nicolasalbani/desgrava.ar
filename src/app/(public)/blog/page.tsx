import type { Metadata } from "next";
import { PostCard } from "@/components/blog/post-card";
import { getAllPosts } from "@/lib/blog/posts";

export const metadata: Metadata = {
  title: "Blog · desgrava.ar",
  description:
    "Cómo funciona Ganancias en Argentina, qué podés deducir, y cómo desgrava.ar te ayuda a recuperar lo que es tuyo.",
  alternates: {
    canonical: "https://desgrava.ar/blog",
    types: {
      "application/rss+xml": "https://desgrava.ar/blog/rss.xml",
    },
  },
  openGraph: {
    type: "website",
    url: "https://desgrava.ar/blog",
    title: "Blog · desgrava.ar",
    description:
      "Cómo funciona Ganancias en Argentina, qué podés deducir, y cómo desgrava.ar te ayuda a recuperar lo que es tuyo.",
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="bg-background overflow-x-hidden">
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-8 md:px-6 md:pt-16 md:pb-12">
          <header className="space-y-3">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              Blog · desgrava.ar
            </p>
            <h1 className="text-foreground text-3xl font-bold tracking-tight md:text-5xl">
              Cómo recuperar lo que Ganancias te saca
            </h1>
            <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
              Cómo funciona el Impuesto a las Ganancias en Argentina, qué podés deducir, y cómo
              desgrava.ar te ayuda a presentar el F.572 / SiRADIG sin perder tiempo.
            </p>
          </header>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
          {posts.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-base">
              Pronto vamos a publicar acá.
            </p>
          ) : (
            <div>
              {posts.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
