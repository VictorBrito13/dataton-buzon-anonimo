"use client";

import { useCallback, useEffect, useState } from "react";
import { esSesionVencida, mensajeDeError } from "@/lib/autoridad/api";
import { usePanel } from "./contexto";

type Resultado<T> = { version: number; datos: T | null; error: string | null };

/** Conserva los datos durante una recarga: la vista no parpadea ni pierde el foco. */
export const useCarga = <T>(cargar: (signal: AbortSignal) => Promise<T>) => {
  const { marcarActiva, terminarSesion } = usePanel();
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState<Resultado<T> | null>(null);

  useEffect(() => {
    const control = new AbortController();
    cargar(control.signal)
      .then((datos) => {
        if (control.signal.aborted) return;
        marcarActiva();
        setResultado({ version, datos, error: null });
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        if (esSesionVencida(error)) {
          terminarSesion();
          return;
        }
        setResultado((previo) => ({
          version,
          datos: previo?.datos ?? null,
          error: mensajeDeError(error),
        }));
      });
    return () => control.abort();
  }, [cargar, version, marcarActiva, terminarSesion]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return {
    datos: resultado?.datos ?? null,
    error: resultado?.error ?? null,
    cargando: resultado?.version !== version,
    recargar,
  };
};
