import {
  detalleDenunciaAutoridad,
  respuestaListadoAutoridad,
  solicitudCambioEtapa,
  solicitudMensajeAutoridad,
  solicitudSesionAutoridad,
  type DetalleDenunciaAutoridad,
  type Etapa,
  type RespuestaListadoAutoridad,
} from "@dataton/shared";
import { z } from "zod";
import { ErrorApi, llamarApi } from "@/lib/api";

/**
 * Único punto que conoce las rutas del panel. api.ts define los cuerpos pero no las
 * rutas: si el backend usa otras, solo cambia este archivo. Parsear con los esquemas
 * descarta cualquier campo ajeno al contrato, así que un dato de más no se puede mostrar.
 */
const RUTA_SESION = "/autoridad/sesion";
const RUTA_DENUNCIAS = "/autoridad/denuncias";
const rutaDenuncia = (id: string) => `${RUTA_DENUNCIAS}/${encodeURIComponent(id)}`;

/** El panel es el único lugar que usa la cookie; el valor por defecto sigue siendo "omit". */
const CON_SESION = { credentials: "same-origin" } as const;

export const iniciarSesion = async (datos: { usuario: string; contrasena: string }) => {
  await llamarApi<unknown>(RUTA_SESION, {
    ...CON_SESION,
    method: "POST",
    body: JSON.stringify(solicitudSesionAutoridad.parse(datos)),
  });
};

export const cerrarSesion = async () => {
  await llamarApi<unknown>(RUTA_SESION, { ...CON_SESION, method: "DELETE" });
};

export const listarDenuncias = async (signal?: AbortSignal): Promise<RespuestaListadoAutoridad> =>
  respuestaListadoAutoridad.parse(
    await llamarApi<unknown>(RUTA_DENUNCIAS, { ...CON_SESION, signal }),
  );

export const obtenerDenuncia = async (
  id: string,
  signal?: AbortSignal,
): Promise<DetalleDenunciaAutoridad> =>
  detalleDenunciaAutoridad.parse(
    await llamarApi<unknown>(rutaDenuncia(id), { ...CON_SESION, signal }),
  );

export const cambiarEtapa = async (id: string, etapa: Etapa) => {
  await llamarApi<unknown>(`${rutaDenuncia(id)}/etapa`, {
    ...CON_SESION,
    method: "POST",
    body: JSON.stringify(solicitudCambioEtapa.parse({ etapa })),
  });
};

export const responder = async (id: string, cuerpo: string) => {
  await llamarApi<unknown>(`${rutaDenuncia(id)}/mensajes`, {
    ...CON_SESION,
    method: "POST",
    body: JSON.stringify(solicitudMensajeAutoridad.parse({ cuerpo: cuerpo.trim() })),
  });
};

/** Binario: llamarApi solo entiende JSON. */
export const descargarEvidencia = async (
  denunciaId: string,
  evidenciaId: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  const respuesta = await fetch(
    `/api/v1${rutaDenuncia(denunciaId)}/evidencias/${encodeURIComponent(evidenciaId)}`,
    { ...CON_SESION, cache: "no-store", referrerPolicy: "no-referrer" },
  );
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, "No pudimos descargar la evidencia.");
  }
  return new Uint8Array(await respuesta.arrayBuffer());
};

export const esSesionVencida = (error: unknown): boolean =>
  error instanceof ErrorApi && error.estado === 401;

/** Solo se muestra lo que el servidor redactó para el público; lo demás no aporta a quien tramita. */
export const mensajeDeError = (error: unknown): string =>
  error instanceof ErrorApi
    ? error.message
    : "No pudimos comunicarnos con el servidor. Inténtalo de nuevo.";
