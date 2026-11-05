import { respuestaConsulta, type Credencial, type RespuestaConsulta } from "@dataton/shared";
import { ErrorApi } from "@/lib/api";
import { MENSAJE_SIN_CONEXION } from "@/lib/denuncia/errores";
import type { PuertoBuzon, PuertoTrabajo } from "@/lib/denuncia/puertos";
import { ErrorAcceso, prepararCredencial, type EntradaCredencial } from "./credencial";

export interface DependenciasConsulta {
  buzon: Pick<PuertoBuzon, "consultar">;
  trabajo: PuertoTrabajo;
}

/** Vuelve a consultar con una credencial que ya está en memoria. */
export const consultarConCredencial = async (
  credencial: Credencial,
  { buzon, trabajo }: DependenciasConsulta,
): Promise<RespuestaConsulta> => {
  let cruda: unknown;
  try {
    const pow = await trabajo.resolverPow();
    cruda = await buzon.consultar({ pow, credencial });
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 401) throw new ErrorAcceso();
    if (error instanceof ErrorApi && error.estado < 500) throw error;
    throw new Error(MENSAJE_SIN_CONEXION);
  }
  return respuestaConsulta.parse(cruda);
};

export const consultarDenuncia = async (
  entrada: EntradaCredencial,
  dependencias: DependenciasConsulta,
): Promise<{ credencial: Credencial; consulta: RespuestaConsulta }> => {
  const credencial = await prepararCredencial(entrada, dependencias.trabajo.derivarAccesoId);
  return { credencial, consulta: await consultarConCredencial(credencial, dependencias) };
};
