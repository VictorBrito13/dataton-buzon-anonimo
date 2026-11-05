"use client";

import dynamic from "next/dynamic";

/** Solo en el navegador: el asistente lee el borrador local y genera la frase en el dispositivo. */
const Asistente = dynamic(() => import("./asistente").then((m) => m.Asistente), {
  ssr: false,
  loading: () => (
    <p role="status" className="mt-6">
      Cargando el formulario…
    </p>
  ),
});

export function CargadorAsistente({ modeloDisponible }: { modeloDisponible: boolean }) {
  return <Asistente modeloDisponible={modeloDisponible} />;
}
