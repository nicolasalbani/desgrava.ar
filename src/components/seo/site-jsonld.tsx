const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "desgrava.ar",
  url: "https://desgrava.ar",
  logo: "https://desgrava.ar/logo.png",
  sameAs: ["https://www.linkedin.com/in/nicolasalbani/"],
};

const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "desgrava.ar",
  url: "https://desgrava.ar",
  inLanguage: "es-AR",
};

export function SiteJsonLd() {
  return (
    <>
      <script
        id="site-organization-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSONLD) }}
      />
      <script
        id="site-website-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }}
      />
    </>
  );
}
