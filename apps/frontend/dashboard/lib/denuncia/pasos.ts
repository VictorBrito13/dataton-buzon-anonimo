/** Orden del asistente de denuncia. El envío va al final: nada sale antes de que la persona lo decida. */
export const PASOS = [
  { clave: "hechos", titulo: "Qué pasó" },
  { clave: "personas", titulo: "Personas o entes involucrados" },
  { clave: "evidencias", titulo: "Evidencias" },
  { clave: "revision", titulo: "Revisión" },
  { clave: "frase", titulo: "Tu frase" },
  { clave: "envio", titulo: "Envío" },
] as const;

export type ClavePaso = (typeof PASOS)[number]["clave"];

const indice = (clave: ClavePaso): number => PASOS.findIndex((p) => p.clave === clave);

export const numeroPaso = (clave: ClavePaso): number => indice(clave) + 1;

export const pasoSiguiente = (clave: ClavePaso): ClavePaso | null =>
  PASOS[indice(clave) + 1]?.clave ?? null;

export const pasoAnterior = (clave: ClavePaso): ClavePaso | null =>
  PASOS[indice(clave) - 1]?.clave ?? null;

export const tituloPaso = (clave: ClavePaso): string => PASOS[indice(clave)]?.titulo ?? "";

export const anuncioPaso = (clave: ClavePaso): string =>
  `Paso ${numeroPaso(clave)} de ${PASOS.length}: ${tituloPaso(clave)}`;
