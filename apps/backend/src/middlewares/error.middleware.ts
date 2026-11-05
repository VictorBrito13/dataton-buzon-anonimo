import type { NextFunction, Request, Response } from "express";
import { ErrorDominio } from "../compartido/dominio/errores.js";
import { registrarError } from "../compartido/infraestructura/registro.js";
import { env } from "../config/env.js";
import { HttpError } from "../errors/http-error.js";

/** Traducción de reglas de negocio a HTTP: el dominio no conoce estos números. */
const ESTADO_POR_CODIGO: Record<string, number> = {
  pow_invalida: 403,
  municipio_fuera_de_estado: 400,
  relato_sin_sellar: 400,
  demasiadas_evidencias: 400,
  evidencia_invalida: 400,
  evidencias_exceden_total: 413,
  acceso_duplicado: 409,
  evidencia_vacia: 400,
  evidencia_demasiado_grande: 413,
  evidencia_demasiado_compleja: 413,
  cuota_subidas_agotada: 503,
  tipo_no_permitido: 415,
  metadatos_residuales: 422,
  evidencia_danada: 422,
  evidencia_cifrada: 422,
  contenido_activo: 422,
  transicion_invalida: 409,
  denuncia_no_encontrada: 404,
  evidencia_no_encontrada: 404,
  credenciales_invalidas: 401,
  demasiados_intentos: 429,
};

/** La URL pedida no se repite: puede traer datos en su consulta. */
export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new HttpError(404, "Ruta no encontrada."));
};

const describir = (error: unknown): { status: number; message: string; details?: unknown } => {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message, details: error.details };
  }
  if (error instanceof ErrorDominio) {
    const status = ESTADO_POR_CODIGO[error.codigo];
    if (status) return { status, message: error.message };
  }
  // Errores de body-parser: traen el cuerpo adjunto, así que no se reutiliza nada de ellos.
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 413) return { status, message: "El contenido es demasiado grande." };
  if (typeof status === "number" && status >= 400 && status < 500) {
    return { status, message: "La solicitud no es válida." };
  }
  return { status: 500, message: "Ocurrió un error interno." };
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const { status, message, details } = describir(error);

  if (status >= 500) registrarError("error no controlado", error);

  res.status(status).json({
    error: {
      message,
      ...(details !== undefined ? { details } : {}),
      ...(env.nodeEnv === "development" && error instanceof Error ? { stack: error.stack } : {}),
    },
  });
};
