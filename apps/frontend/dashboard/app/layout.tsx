import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { AvisoPrototipo } from "@/components/aviso-prototipo";
import { SiteHeader } from "@/components/site-header";
import { scriptTemaInicial } from "@/lib/tema/tema";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Buzón Anónimo", template: "%s · Buzón Anónimo" },
  description:
    "Denuncia faltas administrativas y hechos de corrupción sin cuenta, sin correo y sin teléfono.",
  referrer: "no-referrer",
  robots: { index: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#11181f" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render dinámico obligatorio: el HTML estático no llevaría el nonce de la CSP y se bloquearían sus scripts.
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="es-MX" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Marca el tema antes de pintar: evita el destello. La CSP lo admite por el nonce. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: scriptTemaInicial() }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:m-2 focus:inline-flex focus:min-h-11 focus:items-center focus:bg-superficie focus:p-2"
        >
          Saltar al contenido
        </a>
        <AvisoPrototipo />
        <SiteHeader />
        <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
