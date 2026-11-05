import type { Metadata } from "next";
import Link from "next/link";
import { SimboloLogo } from "@/components/logo";

export const metadata: Metadata = { title: "Página no encontrada" };

export default function NoEncontrada() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 py-8 sm:py-16">
      <SimboloLogo className="size-16" />
      <h1 className="text-3xl font-semibold sm:text-4xl">No encontramos esta página</h1>
      <p className="text-lg">El enlace puede estar incompleto o haber cambiado.</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Link
          prefetch={false}
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-sm bg-marca px-5 py-2 font-semibold text-marca-tinta no-underline hover:underline"
        >
          Ir al inicio
        </Link>
        <Link
          prefetch={false}
          href="/seguimiento"
          className="inline-flex min-h-11 items-center justify-center rounded-sm border border-borde-fuerte bg-superficie px-4 py-2 font-medium text-tinta no-underline hover:bg-marca-suave"
        >
          Ver una denuncia que ya hice
        </Link>
      </div>
    </div>
  );
}
