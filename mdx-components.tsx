import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import type { MDXComponents } from "mdx/types";
import { PersonaExampleCard } from "@/components/blog/persona-example-card";

function isInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

function MdxLink({ href, children, ...rest }: ComponentPropsWithoutRef<"a">) {
  if (!href) return <a {...rest}>{children}</a>;
  if (isInternalHref(href)) {
    return (
      <Link href={href} className="text-primary hover:underline" {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
      {...rest}
    >
      {children}
    </a>
  );
}

export const mdxComponents: MDXComponents = {
  a: MdxLink,
  blockquote: (props) => (
    <blockquote
      className="border-primary text-muted-foreground border-l-4 pl-4 italic"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.92em]"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="border-border bg-muted text-foreground overflow-x-auto rounded-xl border p-4 font-mono text-sm"
      {...props}
    />
  ),
  PersonaExampleCard,
};

export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...mdxComponents, ...components };
}
