"use client";

import "@/lib/autoridad/zod-sin-eval";
import type { ReactNode } from "react";
import { BarraSesion } from "./barra-sesion";
import { ProveedorPanel, usePanel } from "./contexto";
import { FormularioSesion } from "./formulario-sesion";
import { RecuadroSinDatos } from "./recuadro-sin-datos";

function Contenido({ children }: { children: ReactNode }) {
  const { sesion } = usePanel();
  if (sesion === "sin_sesion") return <FormularioSesion />;
  return (
    <>
      {sesion === "activa" && <BarraSesion />}
      {children}
    </>
  );
}

/** Vive en el layout: la clave en memoria sobrevive a la navegación entre lista y detalle. */
export function MarcoPanel({ children }: { children: ReactNode }) {
  return (
    <ProveedorPanel>
      <div className="space-y-4">
        <RecuadroSinDatos />
        <Contenido>{children}</Contenido>
      </div>
    </ProveedorPanel>
  );
}
