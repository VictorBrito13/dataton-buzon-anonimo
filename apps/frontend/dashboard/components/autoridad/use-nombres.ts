"use client";

import { useMemo } from "react";
import { useEntes, useMunicipios } from "@/components/denuncia/catalogos";
import { nombresDeEntes, textoEnte, textoMunicipio } from "@/lib/autoridad/nombres";

/** Catálogos del mismo origen; si no cargan, el panel sigue mostrando los códigos. */
export const useNombres = () => {
  const { datos: municipios } = useMunicipios();
  const { datos: entes } = useEntes(true);
  const nombres = useMemo(() => (entes ? nombresDeEntes(entes) : null), [entes]);
  return {
    municipio: (clave: string | null) => textoMunicipio(municipios, clave),
    ente: (enteId: string | null) => textoEnte(nombres, enteId),
  };
};
