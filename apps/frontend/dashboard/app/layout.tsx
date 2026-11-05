import type { Metadata } from "next";
import { connection } from "next/server";
import { AvisoPrototipo } from "@/components/aviso-prototipo";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Buzón Anónimo", template: "%s · Buzón Anónimo" },
  description:
    "Denuncia faltas administrativas y hechos de corrupción sin cuenta, sin correo y sin teléfono.",
  referrer: "no-referrer",
  robots: { index: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render dinámico obligatorio: el HTML estático no llevaría el nonce de la CSP y se bloquearían sus scripts.
  await connection();

  return (
    <html lang="es-MX" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:z-20 focus:m-2 focus:inline-flex focus:min-h-11 focus:items-center focus:bg-superficie focus:p-2"
        >
          Saltar al contenido
        </a>
        <AvisoPrototipo />
        <SiteHeader />
        <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
