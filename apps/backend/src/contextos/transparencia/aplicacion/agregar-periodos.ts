import { calcularIndicadoresEnte, type HechosEnte } from "../dominio/indicadores.js";
import type { CeldaVista } from "../dominio/k-anonimato.js";
import {
  fechaDeCorte,
  finDePeriodo,
  inicioDePeriodo,
  periodosPublicables,
} from "../dominio/periodo.js";
import {
  CLAVE_SIN_ENTE,
  construirPublicacion,
  type DenunciaAgregable,
  type Universo,
} from "../dominio/publicacion.js";
import type {
  DenunciaFuente,
  FilaAgregado,
  FuenteDenuncias,
  RepositorioPublicacion,
} from "./puertos.js";

export const TABLA_INDICADORES = "indicador_ente";

type HechosInternos = Pick<HechosEnte, "conRespuesta" | "tiempos">;

const diasEntre = (desde: string, hasta: string): number =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

/** Fotografía de un trimestre en su fecha de corte: el mismo resultado sin importar cuándo corra. */
export const resumirPeriodo = (
  denuncias: readonly DenunciaFuente[],
  periodo: string,
  rezagoDias: number,
): { denuncias: DenunciaAgregable[]; hechos: Map<string, HechosInternos> } => {
  const corte = fechaDeCorte(periodo, rezagoDias);
  const hechos = new Map<string, { conRespuesta: number; tiempos: HechosInternos["tiempos"] }>();
  const agregables: DenunciaAgregable[] = [];

  for (const d of denuncias) {
    const etapas = d.etapas.filter((e) => e.dia <= corte);
    const vigente = etapas.at(-1);
    if (!vigente) continue;
    agregables.push({
      estado: d.estado,
      municipio: d.municipio,
      tipoFalta: d.tipoFalta,
      etapa: vigente.etapa,
      ente: d.enteId,
      n: 1,
    });
    if (d.enteId === null) continue;

    const propios = hechos.get(d.enteId) ?? { conRespuesta: 0, tiempos: {} };
    const respondida = etapas.length > 1 || (d.respuestaDia !== null && d.respuestaDia <= corte);
    if (respondida) propios.conRespuesta += 1;
    const tiempos: Record<string, { denuncias: number; diasAcumulados: number }> = {
      ...propios.tiempos,
    };
    for (let i = 1; i < etapas.length; i += 1) {
      const previa = etapas[i - 1];
      const actual = etapas[i];
      if (!previa || !actual) continue;
      const acumulado = tiempos[previa.etapa] ?? { denuncias: 0, diasAcumulados: 0 };
      tiempos[previa.etapa] = {
        denuncias: acumulado.denuncias + 1,
        diasAcumulados: acumulado.diasAcumulados + diasEntre(previa.dia, actual.dia),
      };
    }
    hechos.set(d.enteId, { conRespuesta: propios.conRespuesta, tiempos });
  }
  return { denuncias: agregables, hechos };
};

export interface OpcionesAgregacion {
  k: number;
  rezagoDias: number;
  hoy: string;
  desde: string;
  universo: Universo;
}

const publicarPeriodo = (
  denuncias: readonly DenunciaFuente[],
  periodo: string,
  { k, rezagoDias, universo }: OpcionesAgregacion,
): FilaAgregado[] => {
  const resumen = resumirPeriodo(denuncias, periodo, rezagoDias);
  const entes = [...new Set([...universo.entes, ...resumen.hechos.keys()])].sort();
  const filas = construirPublicacion(resumen.denuncias, { ...universo, entes }, { k });
  const porId = new Map(filas.map((f) => [f.id, f]));
  const celda = (id: string): CeldaVista => {
    const fila = porId.get(id);
    return fila ? { conteo: fila.conteo, motivo: fila.motivo } : { conteo: 0, motivo: "publicada" };
  };

  const indicadores: FilaAgregado[] = entes
    .filter((ente) => ente !== CLAVE_SIN_ENTE)
    .map((ente) => {
      const propios = resumen.hechos.get(ente);
      const detalle = calcularIndicadoresEnte(
        {
          ente,
          total: celda(`ente=${ente}`),
          porEtapa: {
            recibida: celda(`ente=${ente}|etapa=recibida`),
            archivada: celda(`ente=${ente}|etapa=archivada`),
            sin_competencia: celda(`ente=${ente}|etapa=sin_competencia`),
          },
          conRespuesta: propios?.conRespuesta ?? 0,
          tiempos: propios?.tiempos ?? {},
        },
        { k },
      );
      return {
        dimensiones: TABLA_INDICADORES,
        claves: { ente },
        conteo: null,
        motivo: detalle.motivo === "publicado" ? ("publicada" as const) : ("menor_a_k" as const),
        k,
        detalle,
      };
    });

  return [
    ...filas.map(({ dimensiones, claves, conteo, motivo }) => ({
      dimensiones,
      claves,
      conteo,
      motivo,
      k,
    })),
    ...indicadores,
  ];
};

/**
 * Publica los trimestres cerrados que falten. Un trimestre publicado queda congelado: recalcularlo
 * con datos posteriores permitiría restar dos versiones y aislar un caso nuevo.
 */
export const agregarPeriodos = async (
  fuente: FuenteDenuncias,
  repositorio: RepositorioPublicacion,
  opciones: OpcionesAgregacion,
): Promise<string[]> => {
  const yaPublicados = new Set(await repositorio.periodosPublicados());
  const nuevos: string[] = [];
  for (const periodo of periodosPublicables(opciones.desde, opciones.hoy, opciones.rezagoDias)) {
    if (yaPublicados.has(periodo)) continue;
    const denuncias = await fuente.denunciasRecibidasEntre(
      inicioDePeriodo(periodo),
      finDePeriodo(periodo),
    );
    if (denuncias.length === 0) continue;
    await repositorio.guardarPeriodo(periodo, publicarPeriodo(denuncias, periodo, opciones));
    nuevos.push(periodo);
  }
  return nuevos;
};
