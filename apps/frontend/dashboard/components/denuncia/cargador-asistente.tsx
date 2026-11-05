"use client";

import { useSyncExternalStore } from "react";
import { Asistente } from "./asistente";

const sinSuscripcion = () => () => {};

/**
 * Solo en el navegador: el asistente lee el borrador local y genera la frase en el dispositivo.
 * No usa `next/dynamic`: el código viaja con los scripts de la ruta en vez de pedirse después
 * de que corren, lo que evita un viaje de red más (más de medio segundo con mala señal).
 */
export function CargadorAsistente({ modeloDisponible }: { modeloDisponible: boolean }) {
  const enNavegador = useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false,
  );
  if (!enNavegador) {
    return (
      <p role="status" className="mt-6">
        Cargando el formulario…
      </p>
    );
  }
  return <Asistente modeloDisponible={modeloDisponible} />;
}
