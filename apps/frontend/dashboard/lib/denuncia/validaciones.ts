import { CLAVES_ESTADO, CLAVES_TIPO_FALTA } from "@dataton/shared";

export interface Hechos {
  estado: string;
  municipio: string;
  tipoFalta: string;
  enteId: string;
  /** "AAAA-MM" o "no_recuerdo". Solo viaja dentro del relato sellado. */
  cuando: string;
  relato: string;
}

export interface Persona {
  nombre: string;
  cargo: string;
}

export type ErroresCampo = Record<string, string>;

export const MIN_RELATO = 20;
export const MAX_RELATO = 20_000;
export const MAX_PERSONAS = 20;
const MAX_CAMPO_PERSONA = 300;

const incluye = (lista: readonly string[], valor: string) => lista.includes(valor);

export const validarHechos = (hechos: Hechos): ErroresCampo => {
  const errores: ErroresCampo = {};
  if (!incluye(CLAVES_ESTADO, hechos.estado)) {
    errores.estado = "Elige el estado donde pasaron los hechos.";
  }
  if (hechos.municipio && !hechos.municipio.startsWith(hechos.estado)) {
    errores.municipio = "Ese municipio no pertenece al estado que elegiste.";
  }
  if (!incluye(CLAVES_TIPO_FALTA, hechos.tipoFalta)) {
    errores.tipoFalta = "Elige una opción. Si tienes duda, elige «Otra o no estoy seguro».";
  }
  if (!/^(no_recuerdo|\d{4}-(0[1-9]|1[0-2]))$/.test(hechos.cuando)) {
    errores.cuando = "Elige el mes y el año aproximados, o marca «No lo recuerdo».";
  }
  const relato = hechos.relato.trim();
  if (relato.length < MIN_RELATO) {
    errores.relato = "Cuéntanos con un poco más de detalle qué pasó. Unas cuantas frases bastan.";
  } else if (relato.length > MAX_RELATO) {
    errores.relato = `Tu relato es demasiado largo. El máximo es de ${MAX_RELATO.toLocaleString("es-MX")} caracteres.`;
  }
  return errores;
};

export const personasConDatos = (personas: Persona[]): Persona[] =>
  personas
    .map((p) => ({ nombre: p.nombre.trim(), cargo: p.cargo.trim() }))
    .filter((p) => p.nombre || p.cargo);

export const validarPersonas = (personas: Persona[]): ErroresCampo => {
  const errores: ErroresCampo = {};
  personas.forEach((persona, i) => {
    if (persona.nombre.length > MAX_CAMPO_PERSONA) {
      errores[`persona-${i}-nombre`] = "Este dato es demasiado largo.";
    }
    if (persona.cargo.length > MAX_CAMPO_PERSONA) {
      errores[`persona-${i}-cargo`] = "Este dato es demasiado largo.";
    }
  });
  return errores;
};
