import { ErrorApi } from "@/lib/api";

export const MENSAJE_SIN_CONEXION =
  "No pudimos conectar con el buzón. Lo que escribiste sigue aquí. Revisa tu señal e inténtalo de nuevo.";

/**
 * El servidor rechaza con 409 una frase ya registrada. Si el primer envío se perdió a medio camino
 * (se envió, pero no llegó la respuesta), el reintento usa la misma frase y recibe ese 409: lo más
 * probable es que la denuncia sí haya llegado. Nunca se afloja el 409 en el servidor por esto.
 */
export const MENSAJE_QUIZA_YA_LLEGO =
  "Es probable que tu denuncia ya haya llegado en el intento anterior. Antes de volver a enviarla, entra a Seguimiento y consulta con tu frase: si aparece, ya quedó registrada.";

/** Con mala señal lo importante es saber que nada se perdió; nunca se muestran detalles internos. */
export const mensajeDeError = (error: unknown): string =>
  error instanceof ErrorApi && error.estado < 500 ? error.message : MENSAJE_SIN_CONEXION;

export const mensajeDeErrorEnvio = (error: unknown, contexto: { reintento: boolean }): string =>
  contexto.reintento && error instanceof ErrorApi && error.estado === 409
    ? MENSAJE_QUIZA_YA_LLEGO
    : mensajeDeError(error);
