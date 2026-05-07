import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/panel",
          "/comprobantes",
          "/recibos",
          "/automatizacion",
          "/credenciales",
          "/configuracion",
          "/perfil",
          "/trabajadores",
          "/presentaciones",
          "/empleadores",
          "/datos-personales",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: "https://desgrava.ar/sitemap.xml",
    host: "desgrava.ar",
  };
}
