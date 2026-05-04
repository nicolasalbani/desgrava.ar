import Script from "next/script";

export interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
  jsonLdId: string;
}

function FaqJsonLd({ items, jsonLdId }: FaqAccordionProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
  return (
    <Script
      id={jsonLdId}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FaqAccordion({ items, jsonLdId }: FaqAccordionProps) {
  return (
    <>
      <div className="border-border divide-border bg-card divide-y rounded-2xl border">
        {items.map((item, i) => (
          <details key={i} className="group p-4 sm:p-5">
            <summary className="text-foreground flex cursor-pointer list-none items-start justify-between gap-3 font-medium">
              <span>{item.q}</span>
              <span
                aria-hidden="true"
                className="text-muted-foreground shrink-0 text-xl leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
      <FaqJsonLd items={items} jsonLdId={jsonLdId} />
    </>
  );
}
