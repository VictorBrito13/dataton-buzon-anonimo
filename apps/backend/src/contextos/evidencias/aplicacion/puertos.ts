import type { CategoriaEvidencia } from "../dominio/politica.js";

export interface DetectorTipo {
  /** Tipo real según los bytes; nunca el Content-Type que declara el cliente. */
  detectar(bytes: Uint8Array): Promise<string | null>;
}

export interface ResultadoLimpieza {
  bytes: Uint8Array;
  /** Descripción en lenguaje claro de lo eliminado, para mostrarla a quien denuncia. */
  eliminados: string[];
  /** Lo que sigue presente tras limpiar. Cualquier valor provoca el rechazo. */
  residuales: string[];
}

export interface Limpiador {
  limpiar(
    tipo: string,
    categoria: CategoriaEvidencia,
    bytes: Uint8Array,
  ): Promise<ResultadoLimpieza>;
}

export interface SelladorEvidencias {
  sellar(bytes: Uint8Array): Promise<Uint8Array>;
}

export interface EvidenciaSellada {
  tipo: string;
  blobSellado: Uint8Array;
  subidaDia: string;
}

export interface RepositorioEvidencias {
  guardar(evidencia: EvidenciaSellada): Promise<string>;
  eliminarSinDenunciaAntesDe(dia: string): Promise<number>;
}
