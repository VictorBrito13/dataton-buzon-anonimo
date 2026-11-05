import type { RespuestaConfiguracion } from "@dataton/shared";

/** Los límites vienen siempre de GET /configuracion; aquí no hay ninguno fijo. */
export type LimitesEvidencia = Pick<
  RespuestaConfiguracion,
  "maxBytesEvidencia" | "maxEvidencias" | "tiposEvidencia"
>;

export interface EvidenciaSubida {
  evidenciaId: string;
  nombre: string;
  tamano: number;
  eliminadosEnDispositivo: string[];
  eliminadosEnServidor: string[];
}

const NOMBRES_TIPO: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
};

const nombreTipo = (tipo: string): string =>
  NOMBRES_TIPO[tipo] ?? (tipo.split("/")[1] ?? tipo).toUpperCase();

export const describirTipos = (tipos: readonly string[]): string => {
  const nombres = tipos.map(nombreTipo);
  const ultimo = nombres.pop() ?? "";
  return nombres.length > 0 ? `${nombres.join(", ")} y ${ultimo}` : ultimo;
};

export const describirTamano = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
};

export const validarArchivo = (
  archivo: { size: number; type: string },
  limites: LimitesEvidencia,
  cantidadActual: number,
): string | null => {
  if (cantidadActual >= limites.maxEvidencias) {
    return `Puedes adjuntar hasta ${limites.maxEvidencias} archivos. Quita alguno para agregar otro.`;
  }
  if (archivo.size === 0) return "El archivo está vacío.";
  if (!limites.tiposEvidencia.includes(archivo.type)) {
    return "No aceptamos este tipo de archivo. Prueba con una foto o un documento PDF.";
  }
  if (archivo.size > limites.maxBytesEvidencia) {
    return `El archivo pesa demasiado. El máximo es de ${describirTamano(limites.maxBytesEvidencia)}.`;
  }
  return null;
};
