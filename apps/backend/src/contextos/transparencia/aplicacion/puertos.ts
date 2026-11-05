import type { Etapa, RespuestaPdn } from "@dataton/shared";
import type { Motivo } from "../dominio/k-anonimato.js";

/** Lo mínimo que la agregación lee de una denuncia. Nunca el relato ni las credenciales. */
export interface DenunciaFuente {
  estado: string;
  municipio: string | null;
  tipoFalta: string;
  enteId: string | null;
  recibidaDia: string;
  etapas: readonly { etapa: Etapa; dia: string }[];
  /** Primer mensaje de la autoridad. */
  respuestaDia: string | null;
}

export interface FuenteDenuncias {
  denunciasRecibidasEntre(inicio: string, fin: string): Promise<DenunciaFuente[]>;
}

export interface FilaAgregado {
  dimensiones: string;
  claves: Record<string, string>;
  conteo: number | null;
  motivo: Motivo;
  k: number;
  /** Solo indicadores por ente. */
  detalle?: unknown;
}

/** Escritura; usa la conexión privilegiada del proceso de agregación. */
export interface RepositorioPublicacion {
  periodosPublicados(): Promise<string[]>;
  guardarPeriodo(periodo: string, filas: FilaAgregado[]): Promise<void>;
}

/** Lectura; la implementación usa el rol limitado a `agregados_publicos`. */
export interface LecturaAgregados {
  listarPeriodos(): Promise<{ periodo: string; k: number }[]>;
  leerTabla(periodo: string, dimensiones: string): Promise<FilaAgregado[]>;
  leerPeriodo(periodo: string): Promise<FilaAgregado[]>;
}

/**
 * Conteos públicos de otros sistemas de la PDN por institución, desde instantáneas versionadas.
 * Solo conteos, nunca registros individuales.
 */
export interface FuenteDatosPdn {
  resumen(estado?: string): RespuestaPdn;
}
