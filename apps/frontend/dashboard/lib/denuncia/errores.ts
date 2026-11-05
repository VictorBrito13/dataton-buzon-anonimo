import { ErrorApi } from "@/lib/api";

export const MENSAJE_SIN_CONEXION =
  "No pudimos conectar con el buzón. Lo que escribiste sigue aquí. Revisa tu señal e inténtalo de nuevo.";

/** Con mala señal lo importante es saber que nada se perdió; nunca se muestran detalles internos. */
export const mensajeDeError = (error: unknown): string =>
  error instanceof ErrorApi && error.estado < 500 ? error.message : MENSAJE_SIN_CONEXION;
