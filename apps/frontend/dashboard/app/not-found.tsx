import type { Metadata } from "next";
import Link from "next/link";

export const metadata = {
  title: "Página no encontrada",
} satisfies Metadata;

export default function NotFound() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-tinta">No encontramos esta página</h1>
      <p className="mt-3 text-lg text-tinta-suave">
        Puede que el enlace esté incompleto o que la dirección haya cambiado.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-sm bg-marca px-6 py-3 text-lg font-semibold text-marca-tinta no-underline hover:underline"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
