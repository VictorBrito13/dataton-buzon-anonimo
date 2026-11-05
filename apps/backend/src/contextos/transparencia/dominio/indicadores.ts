import type { CeldaVista } from "./k-anonimato.js";

/**
 * Indicadores por ente. Son una señal para priorizar revisión, nunca una acusación. Un porcentaje
 * publicado junto a su total deja despejar el numerador, así que cada uno se somete a la misma
 * regla que las celdas: nada que permita calcular menos de k casos.
 */

export type SenalEnte = "priorizar_revision" | "sin_senal" | "datos_insuficientes";

export const UMBRAL_RESPUESTA_BAJA = 50;

export interface HechosEnte {
  ente: string;
  /** Celdas ya protegidas por el motor; ocultas aquí, ocultas en el indicador. */
  total: CeldaVista;
  porEtapa: {
    recibida: CeldaVista;
    archivada: CeldaVista;
    sin_competencia: CeldaVista;
  };
  /** Valor real, de uso interno: solo sale como porcentaje si pasa la regla. */
  conRespuesta: number;
  /** Por etapa: denuncias que la concluyeron y días que estuvieron en ella. */
  tiempos: Readonly<Record<string, { denuncias: number; diasAcumulados: number }>>;
}

export interface IndicadoresEnte {
  ente: string;
  motivo: "publicado" | "ente_menor_a_k";
  denuncias: number | null;
  porcentajeConRespuesta: number | null;
  porcentajeTurnado: number | null;
  porcentajeArchivado: number | null;
  porcentajeSinCompetencia: number | null;
  tiempoPromedioDias: Record<string, number | null>;
  senal: SenalEnte;
}

const porcentaje = (parte: number, total: number): number => Math.round((parte / total) * 100);

export const calcularIndicadoresEnte = (
  { ente, total, porEtapa, conRespuesta, tiempos }: HechosEnte,
  { k }: { k: number },
): IndicadoresEnte => {
  const n = total.conteo;
  if (n === null || n === 0) {
    return {
      ente,
      motivo: n === null ? "ente_menor_a_k" : "publicado",
      denuncias: n,
      porcentajeConRespuesta: null,
      porcentajeTurnado: null,
      porcentajeArchivado: null,
      porcentajeSinCompetencia: null,
      tiempoPromedioDias: {},
      senal: "datos_insuficientes",
    };
  }

  const seguro = (casos: number): boolean => casos === 0 || casos >= k;
  const porcentajeRespuesta =
    seguro(conRespuesta) && seguro(n - conRespuesta) ? porcentaje(conRespuesta, n) : null;
  const deCelda = (celda: CeldaVista): number | null =>
    celda.conteo === null ? null : porcentaje(celda.conteo, n);

  const recibidas = porEtapa.recibida.conteo;
  const turnadas = recibidas === null ? null : n - recibidas;

  const tiempoPromedioDias: Record<string, number | null> = {};
  for (const [etapa, { denuncias, diasAcumulados }] of Object.entries(tiempos)) {
    tiempoPromedioDias[etapa] = denuncias >= k ? Math.round(diasAcumulados / denuncias) : null;
  }

  let senal: SenalEnte = "datos_insuficientes";
  if (porcentajeRespuesta !== null) {
    senal = porcentajeRespuesta < UMBRAL_RESPUESTA_BAJA ? "priorizar_revision" : "sin_senal";
  }

  return {
    ente,
    motivo: "publicado",
    denuncias: n,
    porcentajeConRespuesta: porcentajeRespuesta,
    porcentajeTurnado: turnadas !== null && seguro(turnadas) ? porcentaje(turnadas, n) : null,
    porcentajeArchivado: deCelda(porEtapa.archivada),
    porcentajeSinCompetencia: deCelda(porEtapa.sin_competencia),
    tiempoPromedioDias,
    senal,
  };
};
