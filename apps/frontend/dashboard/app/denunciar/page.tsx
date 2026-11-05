import type { Metadata } from "next";
import { CargadorAsistente } from "@/components/denuncia/cargador-asistente";
import { modeloNerPublicado } from "@/lib/infraestructura/modelo-publicado";

export const metadata: Metadata = { title: "Hacer una denuncia" };

export default function Denunciar() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">Hacer una denuncia</h1>
      <noscript>
        <p className="mt-4 font-semibold">
          Este formulario necesita JavaScript: con él se sella tu relato en tu propio dispositivo.
        </p>
      </noscript>
      <CargadorAsistente modeloDisponible={modeloNerPublicado()} />
    </div>
  );
}
