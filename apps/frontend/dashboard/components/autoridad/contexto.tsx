"use client";

import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { crearBovedaDeClave, type BovedaDeClave } from "@/lib/autoridad/clave";

/** "desconocida": la cookie es HttpOnly; solo la primera respuesta de la API dice si hay sesión. */
export type EstadoSesion = "desconocida" | "activa" | "sin_sesion";

type ContextoPanel = {
  sesion: EstadoSesion;
  marcarActiva: () => void;
  /** Sin sesión tampoco queda clave en memoria. */
  terminarSesion: () => void;
  boveda: BovedaDeClave;
  clave: JsonWebKey | null;
};

const Contexto = createContext<ContextoPanel | null>(null);

export function ProveedorPanel({ children }: { children: ReactNode }) {
  const [boveda] = useState(crearBovedaDeClave);
  const [sesion, setSesion] = useState<EstadoSesion>("desconocida");
  const clave = useSyncExternalStore(boveda.suscribir, boveda.clave, () => null);

  const marcarActiva = useCallback(() => setSesion("activa"), []);
  const terminarSesion = useCallback(() => {
    boveda.olvidar();
    setSesion("sin_sesion");
  }, [boveda]);

  const valor = useMemo(
    () => ({ sesion, marcarActiva, terminarSesion, boveda, clave }),
    [sesion, marcarActiva, terminarSesion, boveda, clave],
  );
  return <Contexto value={valor}>{children}</Contexto>;
}

export const usePanel = (): ContextoPanel => {
  const contexto = use(Contexto);
  if (!contexto) throw new Error("usePanel requiere ProveedorPanel");
  return contexto;
};
