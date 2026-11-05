import type { Metadata } from "next";
import { Suspense } from "react";
import { ListaDenuncias } from "@/components/autoridad/lista-denuncias";

export const metadata: Metadata = { title: "Panel de autoridad" };

export default function PaginaAutoridad() {
  return (
    <Suspense fallback={<p className="text-sm text-tinta-suave">Cargando denuncias…</p>}>
      <ListaDenuncias />
    </Suspense>
  );
}
