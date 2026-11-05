import { ErrorDominio } from "../../../compartido/dominio/errores.js";

export type CategoriaEvidencia = "imagen" | "pdf" | "office";

const CATEGORIAS = {
  "image/jpeg": "imagen",
  "image/png": "imagen",
  "image/webp": "imagen",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "office",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "office",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "office",
} as const satisfies Record<string, CategoriaEvidencia>;

export type TipoEvidencia = keyof typeof CATEGORIAS;
export const TIPOS_EVIDENCIA = Object.keys(CATEGORIAS) as TipoEvidencia[];

/** Lista de permitidos: ejecutables, formatos con macros y cualquier otro quedan fuera. */
export const categoriaDe = (tipo: string): CategoriaEvidencia | null =>
  Object.hasOwn(CATEGORIAS, tipo) ? CATEGORIAS[tipo as TipoEvidencia] : null;

export const exigirTamano = (bytes: number, maximo: number): void => {
  if (bytes === 0) throw new ErrorDominio("evidencia_vacia", "El archivo está vacío.");
  if (bytes > maximo) {
    throw new ErrorDominio("evidencia_demasiado_grande", "El archivo supera el tamaño máximo.");
  }
};

/** Un PDF por encima de esto no es una evidencia razonable y sí una forma de agotar CPU y memoria. */
export const LIMITES_PDF = { paginas: 500, objetos: 50_000 } as const;

export const exigirComplejidadPdf = (medida: { paginas: number; objetos: number }): void => {
  if (medida.paginas > LIMITES_PDF.paginas || medida.objetos > LIMITES_PDF.objetos) {
    throw new ErrorDominio(
      "evidencia_demasiado_compleja",
      `Este PDF es demasiado grande para procesarlo: máximo ${LIMITES_PDF.paginas} páginas.`,
    );
  }
};

export interface UsoHuerfanas {
  filas: number;
  bytes: number;
}

/** Cuota global de subidas aún sin denuncia: evita que el almacenamiento se llene sin denunciar. */
export const exigirCuotaHuerfanas = (uso: UsoHuerfanas, cuota: UsoHuerfanas): void => {
  if (uso.filas >= cuota.filas || uso.bytes >= cuota.bytes) {
    throw new ErrorDominio(
      "cuota_subidas_agotada",
      "El buzón no puede recibir más archivos por ahora. Inténtalo más tarde.",
    );
  }
};

/** HU-20: si tras la limpieza aún quedan metadatos, el archivo se rechaza. */
export const exigirSinResiduales = (residuales: readonly string[]): void => {
  if (residuales.length > 0) {
    throw new ErrorDominio(
      "metadatos_residuales",
      "No pudimos quitar todos los metadatos de este archivo.",
    );
  }
};
