/**
 * Lenguaje del depurador. Un hallazgo es un fragmento del relato que podría
 * identificar a alguien; la persona decide qué hacer con él.
 */
export type TipoHallazgo =
  | "curp"
  | "rfc"
  | "telefono"
  | "correo"
  | "clabe"
  | "tarjeta"
  | "nss"
  | "placa"
  | "persona"
  | "lugar"
  | "organizacion"
  | "cargo"
  | "fecha_exacta"
  | "descripcion_unica";

export interface Hallazgo {
  tipo: TipoHallazgo;
  /** "dato": identificador directo que conviene quitar. "contexto": aviso de riesgo. */
  nivel: "dato" | "contexto";
  inicio: number;
  fin: number;
  texto: string;
  /** Explicación breve, en lenguaje claro, para mostrarla a la persona. */
  explicacion: string;
  /** Texto sugerido para reemplazar, como "[teléfono]". */
  sugerencia: string;
}
