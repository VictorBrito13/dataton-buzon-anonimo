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

/** HU-20: si tras la limpieza aún quedan metadatos, el archivo se rechaza. */
export const exigirSinResiduales = (residuales: readonly string[]): void => {
  if (residuales.length > 0) {
    throw new ErrorDominio(
      "metadatos_residuales",
      "No pudimos quitar todos los metadatos de este archivo.",
    );
  }
};
