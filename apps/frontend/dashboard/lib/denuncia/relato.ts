import { personasConDatos, type Persona } from "./validaciones";

/** Valor de `cuando` si la persona no recuerda la fecha. El resto de valores son "AAAA-MM". */
export const NO_RECUERDO = "no_recuerdo";

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

export const describirCuando = (cuando: string): string => {
  if (cuando === NO_RECUERDO) return "No lo recuerda";
  const [anio, mes] = cuando.split("-");
  return `${MESES[Number(mes) - 1]} de ${anio}`;
};

const describirPersona = ({ nombre, cargo }: Persona): string => {
  if (nombre && cargo) return `${nombre} (${cargo})`;
  return nombre || cargo;
};

/**
 * Texto que se sella para la autoridad (D3). La fecha aproximada va aquí adentro y nunca
 * como campo en claro: a diferencia del S5, que la pide exacta, una fecha precisa puede
 * identificar a quien denuncia (docs/investigacion-s5-pdn.md).
 */
export const armarRelato = ({
  relato,
  personas,
  cuando,
}: {
  relato: string;
  personas: Persona[];
  cuando?: string;
}): string => {
  const partes = [relato.trim()];
  if (cuando) partes.unshift(`Cuándo pasó, aproximadamente: ${describirCuando(cuando)}`);
  const lista = personasConDatos(personas);
  if (lista.length > 0) {
    const filas = lista.map((p) => `- ${describirPersona(p)}`).join("\n");
    partes.push(`Personas o entes involucrados:\n${filas}`);
  }
  return partes.join("\n\n");
};
