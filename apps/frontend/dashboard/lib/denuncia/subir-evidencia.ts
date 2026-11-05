import type { ResultadoLimpieza } from "@/lib/privacidad";
import { ErrorLimpieza } from "@/lib/privacidad/dominio/limpieza/errores";
import { mensajeDeError } from "./errores";
import { validarArchivo, type EvidenciaSubida, type LimitesEvidencia } from "./evidencias";
import type { PuertoBuzon, PuertoTrabajo } from "./puertos";

export interface DependenciasEvidencia {
  limpiar: (archivo: File) => Promise<ResultadoLimpieza>;
  trabajo: Pick<PuertoTrabajo, "resolverPow">;
  buzon: Pick<PuertoBuzon, "subirEvidencia">;
}

/** El original nunca sale del dispositivo: si no se pudo limpiar, no se sube. */
export const subirEvidencia = async (
  entrada: { archivo: File; limites: LimitesEvidencia; cantidadActual: number },
  { limpiar, trabajo, buzon }: DependenciasEvidencia,
): Promise<EvidenciaSubida> => {
  const { archivo, limites, cantidadActual } = entrada;
  const invalido = validarArchivo(archivo, limites, cantidadActual);
  if (invalido) throw new Error(invalido);

  let limpieza: ResultadoLimpieza;
  try {
    limpieza = await limpiar(archivo);
  } catch (error) {
    if (error instanceof ErrorLimpieza) throw new Error(error.message);
    throw new Error(
      "No pudimos limpiar este archivo, así que no lo enviamos. Puede estar dañado; prueba con otra copia.",
    );
  }
  const invalidoLimpio = validarArchivo(limpieza.archivo, limites, cantidadActual);
  if (invalidoLimpio) throw new Error(invalidoLimpio);

  try {
    const pow = await trabajo.resolverPow();
    const respuesta = await buzon.subirEvidencia(limpieza.archivo, pow);
    return {
      evidenciaId: respuesta.evidenciaId,
      nombre: archivo.name,
      tamano: limpieza.archivo.size,
      eliminadosEnDispositivo: limpieza.eliminados,
      eliminadosEnServidor: respuesta.metadatosEliminadosEnServidor,
    };
  } catch (error) {
    throw new Error(mensajeDeError(error));
  }
};
