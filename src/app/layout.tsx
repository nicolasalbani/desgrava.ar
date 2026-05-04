import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://desgrava.ar"),
  title: "desgrava.ar - Automatiza tus deducciones en SiRADIG",
  description:
    "Carga tus facturas en SiRADIG de forma automatica. Simula tu ahorro impositivo y gestiona tus deducciones de ganancias.",
  alternates: {
    types: {
      "application/rss+xml": "https://desgrava.ar/blog/rss.xml",
    },
  },
  openGraph: {
    type: "website",
    url: "https://desgrava.ar",
    title: "desgrava.ar - Automatiza tus deducciones en SiRADIG",
    description:
      "Carga tus facturas en SiRADIG de forma automatica. Simula tu ahorro impositivo y gestiona tus deducciones de ganancias.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          <Script
            src={`${process.env.NEXT_PUBLIC_UMAMI_URL || "https://cloud.umami.is"}/script.js`}
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
