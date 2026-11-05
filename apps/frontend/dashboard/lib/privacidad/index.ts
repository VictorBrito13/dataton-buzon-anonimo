/**
 * Contrato de la librería de privacidad en el cliente. Todo se ejecuta en el
 * navegador; nada de esto hace peticiones de red.
 */
export type TipoHallazgo =
  | "curp"
  | "rfc"
  | "telefono"
  | "correo"
  | "clabe"
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

export interface ResultadoLimpieza {
  archivo: File;
  /** Metadatos eliminados, en lenguaje claro: "Ubicación GPS", "Autor". */
  eliminados: string[];
}

export const escanearTexto = async (_texto: string): Promise<Hallazgo[]> => [];

export const limpiarArchivo = async (archivo: File): Promise<ResultadoLimpieza> => ({
  archivo,
  eliminados: [],
});
