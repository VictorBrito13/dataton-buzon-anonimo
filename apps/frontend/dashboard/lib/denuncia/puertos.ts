import type {
  RespuestaConfiguracion,
  RespuestaDenuncia,
  RespuestaEvidencia,
  SolicitudConsulta,
  SolicitudDenuncia,
  solicitudMensajeDenunciante,
} from "@dataton/shared";
import type { z } from "zod";

/** Puertos de los casos de uso: el dominio no conoce fetch, Workers ni React. */
export interface PuertoBuzon {
  obtenerConfiguracion(): Promise<RespuestaConfiguracion>;
  subirEvidencia(archivo: File, pow: string): Promise<RespuestaEvidencia>;
  crearDenuncia(solicitud: SolicitudDenuncia): Promise<RespuestaDenuncia>;
  consultar(solicitud: SolicitudConsulta): Promise<unknown>;
  enviarMensaje(solicitud: z.infer<typeof solicitudMensajeDenunciante>): Promise<unknown>;
}

export interface PuertoTrabajo {
  /** Argon2id en el dispositivo; la frase nunca sale de él. */
  derivarAccesoId(frase: string): Promise<string>;
  /** Pide un desafío y devuelve la solución serializada. */
  resolverPow(): Promise<string>;
}

export type Sellar = (
  publica: JsonWebKey,
  datos: Uint8Array<ArrayBuffer>,
) => Promise<Uint8Array<ArrayBuffer>>;
