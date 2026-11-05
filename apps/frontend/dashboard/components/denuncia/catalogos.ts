"use client";

import { useEffect, useState } from "react";
import type { CatalogoMunicipios, EnteLocal } from "@/lib/denuncia/catalogos-locales";
import { cargarEntes, cargarMunicipios } from "@/lib/infraestructura/catalogos";

export type Carga<T> = { datos: T | null; fallo: boolean };

const useCarga = <T>(cargar: () => Promise<T>, activo: boolean): Carga<T> => {
  const [carga, setCarga] = useState<Carga<T>>({ datos: null, fallo: false });
  useEffect(() => {
    if (!activo) return;
    let vigente = true;
    cargar().then(
      (datos) => vigente && setCarga({ datos, fallo: false }),
      () => vigente && setCarga({ datos: null, fallo: true }),
    );
    return () => {
      vigente = false;
    };
  }, [cargar, activo]);
  return carga;
};

export const useMunicipios = (): Carga<CatalogoMunicipios> => useCarga(cargarMunicipios, true);

/** El catálogo pesa más: se baja solo cuando la persona ya busca o tiene un ente elegido. */
export const useEntes = (activo: boolean): Carga<EnteLocal[]> => useCarga(cargarEntes, activo);
