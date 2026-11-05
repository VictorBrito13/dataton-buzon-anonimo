import type { TokenNer } from "../dominio/ner";

/** Mensajes entre el hilo principal y el Worker del modelo. */
export type MensajeAlWorker =
  { tipo: "cargar" } | { tipo: "analizar"; id: number; fragmentos: string[] };

export type MensajeDelWorker =
  | { tipo: "progreso"; porcentaje: number }
  | { tipo: "listo" }
  | { tipo: "error" }
  | { tipo: "tokens"; id: number; resultados: TokenNer[][] };

/** Lo mínimo que se usa de un Worker; permite probar sin navegador. */
export interface WorkerNer {
  postMessage(mensaje: MensajeAlWorker): void;
  terminate(): void;
  onmessage: ((evento: { data: MensajeDelWorker }) => void) | null;
  onerror: ((evento: unknown) => void) | null;
}

export type EstadoModeloNer = "inactivo" | "cargando" | "listo" | "error";

export interface ProgresoNer {
  estado: EstadoModeloNer;
  /** 0 a 100 mientras se carga. */
  porcentaje: number;
}
