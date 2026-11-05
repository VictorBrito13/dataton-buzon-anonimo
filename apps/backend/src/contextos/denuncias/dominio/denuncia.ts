import type { Etapa, TipoFalta } from "@dataton/shared";
import { diaDe } from "../../../compartido/dominio/dia.js";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import { LARGO_MINIMO_SELLO, selloBienFormado } from "../../../compartido/dominio/sello.js";

/** Límite del prototipo: 5 archivos por denuncia. */
export const MAX_EVIDENCIAS = 5;

/** El total se mide sobre el contenido, sin el sobrecosto fijo que agrega cada sello. */
export const exigirTotalEvidencias = (tamanosSellados: readonly number[], maximo: number): void => {
  const total = tamanosSellados.reduce((suma, t) => suma + Math.max(0, t - LARGO_MINIMO_SELLO), 0);
  if (total > maximo) {
    throw new ErrorDominio(
      "evidencias_exceden_total",
      "Las evidencias superan el tamaño total permitido.",
    );
  }
};

export interface DatosDenuncia {
  estado: string;
  municipio?: string | undefined;
  tipoFalta: TipoFalta;
  enteId?: string | undefined;
  relatoSellado: Uint8Array;
  evidenciaIds: readonly string[];
}

export interface Denuncia {
  estado: string;
  municipio: string | null;
  tipoFalta: TipoFalta;
  enteId: string | null;
  etapa: Etapa;
  recibidaDia: string;
  relatoSellado: Uint8Array;
  evidenciaIds: string[];
}

export const nuevaDenuncia = (datos: DatosDenuncia, instante: Date): Denuncia => {
  if (datos.municipio && !datos.municipio.startsWith(datos.estado)) {
    throw new ErrorDominio(
      "municipio_fuera_de_estado",
      "El municipio no pertenece al estado indicado.",
    );
  }
  if (!selloBienFormado(datos.relatoSellado)) {
    throw new ErrorDominio("relato_sin_sellar", "El relato debe enviarse sellado.");
  }
  const evidenciaIds = [...new Set(datos.evidenciaIds)];
  if (evidenciaIds.length > MAX_EVIDENCIAS) {
    throw new ErrorDominio("demasiadas_evidencias", "Se admiten hasta 5 archivos por denuncia.");
  }
  return {
    estado: datos.estado,
    municipio: datos.municipio ?? null,
    tipoFalta: datos.tipoFalta,
    enteId: datos.enteId ?? null,
    etapa: "recibida",
    recibidaDia: diaDe(instante),
    relatoSellado: datos.relatoSellado,
    evidenciaIds,
  };
};
