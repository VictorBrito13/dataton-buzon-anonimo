import { CLAVES_ETAPA, type Etapa } from "@dataton/shared";
import type { CeldaVista, Motivo } from "./k-anonimato.js";
import { idDeClaves, type FilaPublicada } from "./publicacion.js";

/**
 * Indicadores por ente. Son una señal para priorizar revisión, nunca una acusación. Todo lo que se
 * deriva de las celdas de un ente (porcentajes, tiempos promedio y señal) se publica solo si **todas**
 * sus celdas `ente × etapa` están publicadas: un derivado, incluso oculto, describe las celdas que lo
 * componen. Por ejemplo, el tiempo promedio en recepción se calcula sobre las denuncias que salieron
 * de ahí, que son `total − recibida`; publicarlo u ocultarlo según lleguen a k diría cuánto vale
 * `recibida` cuando la tabla la ocultó. Además, cada porcentaje se somete a la misma regla que las
 * celdas: nada que permita calcular menos de k casos.
 */

export type SenalEnte = "priorizar_revision" | "sin_senal" | "datos_insuficientes";

/**
 * Por qué faltan datos en la fila de un ente:
 * - `publicado`: total y derivados.
 * - `menor_a_k` y `supresion_complementaria`: el total del ente está oculto, por el mismo motivo
 *   que en la tabla por ente; sin total no hay derivados.
 * - `etapa_oculta`: el total se publica, pero alguna celda `ente × etapa` está oculta, así que los
 *   derivados se omiten para no describirla.
 */
export type MotivoIndicador = "publicado" | Exclude<Motivo, "publicada"> | "etapa_oculta";

export const UMBRAL_RESPUESTA_BAJA = 50;

export interface HechosEnte {
  ente: string;
  /** Celdas ya protegidas por el motor; ocultas aquí, ocultas en el indicador. */
  total: CeldaVista;
  /** Celda de cada etapa del catálogo. Una etapa ausente cuenta como cero publicado. */
  porEtapa: Readonly<Partial<Record<Etapa, CeldaVista>>>;
  /** Valor real, de uso interno: solo sale como porcentaje si pasa la regla. */
  conRespuesta: number;
  /** Por etapa: denuncias que la concluyeron y días que estuvieron en ella. */
  tiempos: Readonly<Record<string, { denuncias: number; diasAcumulados: number }>>;
}

/** Lo que la agregación observa de las denuncias de un ente y que no es una celda de la tabla. */
export type HechosObservados = Pick<HechosEnte, "conRespuesta" | "tiempos">;

export interface IndicadoresEnte {
  ente: string;
  motivo: MotivoIndicador;
  denuncias: number | null;
  porcentajeConRespuesta: number | null;
  porcentajeTurnado: number | null;
  porcentajeArchivado: number | null;
  porcentajeSinCompetencia: number | null;
  tiempoPromedioDias: Record<string, number | null>;
  senal: SenalEnte;
}

const CERO_PUBLICADO: CeldaVista = { conteo: 0, motivo: "publicada" };

const porcentaje = (parte: number, total: number): number => Math.round((parte / total) * 100);

const sinDerivados = (
  ente: string,
  motivo: MotivoIndicador,
  denuncias: number | null,
): IndicadoresEnte => ({
  ente,
  motivo,
  denuncias,
  porcentajeConRespuesta: null,
  porcentajeTurnado: null,
  porcentajeArchivado: null,
  porcentajeSinCompetencia: null,
  tiempoPromedioDias: {},
  senal: "datos_insuficientes",
});

export const calcularIndicadoresEnte = (
  { ente, total, porEtapa, conRespuesta, tiempos }: HechosEnte,
  { k }: { k: number },
): IndicadoresEnte => {
  const n = total.conteo;
  if (n === null) {
    if (total.motivo === "publicada") throw new Error(`Total oculto sin motivo en ${ente}`);
    return sinDerivados(ente, total.motivo, null);
  }
  if (n === 0) return sinDerivados(ente, "publicado", 0);

  const celda = (etapa: Etapa): number => {
    const vista = porEtapa[etapa] ?? CERO_PUBLICADO;
    if (vista.conteo === null) throw new Error("celda oculta");
    return vista.conteo;
  };
  if (CLAVES_ETAPA.some((etapa) => (porEtapa[etapa] ?? CERO_PUBLICADO).conteo === null)) {
    return sinDerivados(ente, "etapa_oculta", n);
  }

  // Desde aquí todas las celdas del ente son públicas: los derivados no describen nada oculto.
  const seguro = (casos: number): boolean => casos === 0 || casos >= k;
  const turnadas = n - celda("recibida");
  // Con respuesta = salieron de recepción + recibieron mensaje sin salir. Cada parte debe ser segura.
  const respondidasEnRecepcion = conRespuesta - turnadas;
  const porcentajeRespuesta =
    seguro(conRespuesta) && seguro(n - conRespuesta) && seguro(respondidasEnRecepcion)
      ? porcentaje(conRespuesta, n)
      : null;

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
    porcentajeTurnado: seguro(turnadas) ? porcentaje(turnadas, n) : null,
    porcentajeArchivado: porcentaje(celda("archivada"), n),
    porcentajeSinCompetencia: porcentaje(celda("sin_competencia"), n),
    tiempoPromedioDias,
    senal,
  };
};

/**
 * Indicadores de todos los entes de una publicación ya protegida. Lee las celdas `ente` y
 * `ente × etapa` de las filas publicadas, así que lo oculto en la tabla queda oculto aquí.
 */
export const indicadoresDePublicacion = (
  filas: readonly FilaPublicada[],
  hechos: ReadonlyMap<string, HechosObservados>,
  entes: readonly string[],
  { k }: { k: number },
): IndicadoresEnte[] => {
  const porId = new Map(filas.map((f) => [f.id, f]));
  const celda = (claves: Record<string, string>): CeldaVista => {
    const fila = porId.get(idDeClaves(claves));
    return fila ? { conteo: fila.conteo, motivo: fila.motivo } : CERO_PUBLICADO;
  };
  return entes.map((ente) => {
    const porEtapa: Partial<Record<Etapa, CeldaVista>> = {};
    for (const etapa of CLAVES_ETAPA) porEtapa[etapa] = celda({ ente, etapa });
    const propios = hechos.get(ente);
    return calcularIndicadoresEnte(
      {
        ente,
        total: celda({ ente }),
        porEtapa,
        conRespuesta: propios?.conRespuesta ?? 0,
        tiempos: propios?.tiempos ?? {},
      },
      { k },
    );
  });
};
