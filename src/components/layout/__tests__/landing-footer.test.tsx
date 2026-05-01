import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingFooter } from "@/components/layout/landing-footer";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/lib/landing/contact";

describe("LandingFooter", () => {
  it("renders email and WhatsApp contact links from constants, not env vars", () => {
    delete process.env.SUPPORT_EMAIL;
    delete process.env.SUPPORT_WHATSAPP;

    const html = renderToStaticMarkup(<LandingFooter />);

    expect(html).toContain(`mailto:${SUPPORT_EMAIL}`);
    expect(html).toContain(`https://wa.me/${SUPPORT_WHATSAPP}`);
    expect(html).toContain(SUPPORT_EMAIL);
  });
});
