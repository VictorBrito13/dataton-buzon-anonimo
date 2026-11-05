import {
  nombreMunicipio,
  type CatalogoMunicipios,
  type EnteLocal,
} from "@/lib/denuncia/catalogos-locales";

const SIN_DATO = "No indicado";

/** Una tabla de cientos de filas contra miles de entes no debe recorrer el catálogo por fila. */
export const nombresDeEntes = (entes: readonly EnteLocal[]): ReadonlyMap<string, string> =>
  new Map(entes.map((e) => [String(e.id), e.nombre]));

/** Sin coincidencia, o mientras el catálogo no carga, se conserva el código: no se inventa un nombre. */
export const textoMunicipio = (
  catalogo: CatalogoMunicipios | null,
  clave: string | null,
): string => {
  if (!clave) return SIN_DATO;
  return (catalogo && nombreMunicipio(catalogo, clave)) ?? clave;
};

export const textoEnte = (
  nombres: ReadonlyMap<string, string> | null,
  enteId: string | null,
): string => {
  if (!enteId) return SIN_DATO;
  return nombres?.get(enteId) ?? enteId;
};
