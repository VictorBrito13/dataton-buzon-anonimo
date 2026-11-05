import {
  RUTA_ENTES,
  RUTA_MUNICIPIOS,
  indexarEntes,
  type CatalogoEntes,
  type CatalogoMunicipios,
  type EnteLocal,
} from "@/lib/denuncia/catalogos-locales";

const pedir = async <T>(ruta: string): Promise<T> => {
  const respuesta = await fetch(ruta, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (!respuesta.ok) throw new Error("Catálogo no disponible");
  return (await respuesta.json()) as T;
};

let municipios: Promise<CatalogoMunicipios> | null = null;
let entes: Promise<EnteLocal[]> | null = null;

/** El archivo es el mismo para todas las personas: pedirlo no dice nada de lo que se busca. */
export const cargarMunicipios = (): Promise<CatalogoMunicipios> => {
  municipios ??= pedir<CatalogoMunicipios>(RUTA_MUNICIPIOS).catch((error: unknown) => {
    municipios = null;
    throw error;
  });
  return municipios;
};

export const cargarEntes = (): Promise<EnteLocal[]> => {
  entes ??= pedir<CatalogoEntes>(RUTA_ENTES)
    .then(indexarEntes)
    .catch((error: unknown) => {
      entes = null;
      throw error;
    });
  return entes;
};
