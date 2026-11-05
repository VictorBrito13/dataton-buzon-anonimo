import { normalizarPalabra } from "@dataton/shared";

/**
 * Catálogos servidos desde el propio origen, en public/catalogos/. La búsqueda ocurre
 * solo en memoria: lo que la persona escribe nunca llega a la red.
 *
 * Fuente: versión de pruebas del S5, https://dev-denuncias.plataformadigitalnacional.org/,
 * catálogos c_municipios y entes (consulta por GET del 4 de noviembre de 2026).
 * Se regeneran con scripts/generar-catalogos.mjs.
 */
export const RUTA_MUNICIPIOS = "/catalogos/municipios.json";
export const RUTA_ENTES = "/catalogos/entes.json";

/** Clave AGEE -> [clave AGEM, nombre]. */
export type CatalogoMunicipios = Record<string, readonly (readonly [string, string])[]>;
/** [id, nombre, clave AGEE; "00" significa federal]. */
export type CatalogoEntes = readonly (readonly [number, string, string])[];

export interface MunicipioLocal {
  clave: string;
  nombre: string;
}

export interface EnteLocal {
  id: number;
  nombre: string;
  entidad: string;
  normalizado: string;
}

const FEDERAL = "00";
const MIN_BUSQUEDA = 3;
const MAX_RESULTADOS = 20;

const normalizar = (texto: string): string => normalizarPalabra(texto).replace(/\s+/g, " ");

export const municipiosDeEstado = (
  catalogo: CatalogoMunicipios,
  estado: string,
): MunicipioLocal[] =>
  (catalogo[estado] ?? [])
    .map(([clave, nombre]) => ({ clave: `${estado}${clave}`, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

/** La clave INEGI de 5 dígitos es la del estado (2) seguida de la del municipio (3). */
export const nombreMunicipio = (catalogo: CatalogoMunicipios, clave: string): string | null =>
  catalogo[clave.slice(0, 2)]?.find(([agem]) => agem === clave.slice(2))?.[1] ?? null;

export const indexarEntes = (catalogo: CatalogoEntes): EnteLocal[] =>
  catalogo
    .map(([id, nombre, entidad]) => ({ id, nombre, entidad, normalizado: normalizar(nombre) }))
    .sort((a, b) => a.normalizado.localeCompare(b.normalizado, "es"));

/** El catálogo del S5 repite algunos entes con otro id; la persona no podría distinguirlos. */
const sinRepetidos = (entes: readonly EnteLocal[]): EnteLocal[] => {
  const vistos = new Set<string>();
  return entes.filter((e) => {
    const clave = `${e.entidad}:${e.normalizado}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
};

/** Primero los del estado elegido y luego los federales; no se muestran los de otros estados. */
export const buscarEntes = (
  indice: readonly EnteLocal[],
  consulta: string,
  estado: string,
  limite: number = MAX_RESULTADOS,
): EnteLocal[] => {
  const texto = normalizar(consulta);
  if (texto.length < MIN_BUSQUEDA) return [];
  const palabras = texto.split(" ");
  const coincide = (e: EnteLocal) => palabras.every((p) => e.normalizado.includes(p));
  if (!estado) return sinRepetidos(indice.filter(coincide)).slice(0, limite);
  const delEstado = indice.filter((e) => e.entidad === estado && coincide(e));
  const federales = indice.filter((e) => e.entidad === FEDERAL && coincide(e));
  return sinRepetidos([...delEstado, ...federales]).slice(0, limite);
};

export const nombreEnte = (indice: readonly EnteLocal[], enteId: string): string | null =>
  indice.find((e) => String(e.id) === enteId)?.nombre ?? null;
