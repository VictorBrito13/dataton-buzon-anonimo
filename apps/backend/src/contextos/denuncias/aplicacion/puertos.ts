import type { Etapa } from "@dataton/shared";
import type { Denuncia } from "../dominio/denuncia.js";

/** D1/D2: HMAC con pimienta. Lo único que se guarda de un folio o de un identificador de frase. */
export interface Huellas {
  huella(valor: string): Uint8Array;
}

export interface AzarSeguro {
  bytes(cantidad: number): Uint8Array;
}

export type ResultadoCreacion = "creada" | "acceso_duplicado" | "evidencia_invalida";
export type ViaAcceso = "folio" | "acceso";

export interface Seguimiento {
  etapaActual: Etapa;
  lineaTiempo: { etapa: Etapa; dia: string }[];
  mensajes: {
    autor: "autoridad" | "denunciante";
    dia: string;
    /** Solo los de la autoridad; los del denunciante están sellados y aquí no se leen. */
    cuerpoCifrado: Uint8Array | null;
  }[];
}

export interface RepositorioDenuncias {
  /** Atómico: inserta la denuncia y su primera etapa, y liga evidencias, o no hace nada. */
  crear(
    denuncia: Denuncia,
    huellas: { folio: Uint8Array; acceso: Uint8Array },
  ): Promise<ResultadoCreacion>;
  /** Tamaño de cada evidencia sellada que siga sin denuncia. */
  tamanosEvidencias(ids: readonly string[]): Promise<number[]>;
  buscarId(via: ViaAcceso, huella: Uint8Array): Promise<string | null>;
  seguimiento(id: string): Promise<Seguimiento>;
  agregarMensajeDenunciante(id: string, cuerpoSellado: Uint8Array, dia: string): Promise<void>;
}
