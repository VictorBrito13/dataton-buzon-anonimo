import { CLAVES_ETAPA, TRANSICIONES, type Etapa } from "@dataton/shared";
import { acotarPorIntervalos, propagar, type Cota, type Vista } from "./ataque-intervalos.js";
import type { IndicadoresEnte } from "./indicadores.js";
import type { Linea } from "./k-anonimato.js";
import { idDeClaves } from "./publicacion.js";

/**
 * Atacante que lee **todos** los canales públicos de un trimestre: las tablas (`/agregados` y las
 * descargas publican las mismas celdas) y los indicadores por ente (`/indicadores`). Conoce el
 * código, así que de cada indicador, publicado u oculto, deduce desigualdades sobre las celdas
 * `ente × etapa` y las usa para estrechar las cotas del atacante por intervalos.
 *
 * Lo que sabe sobre cómo se calculan los indicadores:
 * - Las salidas de una etapa son las denuncias que la dejaron antes del corte. Toda denuncia pasa
 *   por `recibida`, así que `salidas(recibida) = total − celda(recibida)`. En general, las salidas de
 *   X están entre la suma de las etapas que solo se alcanzan por X y la suma de todas sus sucesoras.
 * - Un tiempo promedio se publica solo con al menos k salidas; si falta, hubo menos de k.
 * - Una denuncia cuenta "con respuesta" si salió de `recibida` o recibió un mensaje, de modo que
 *   `conRespuesta ≥ salidas(recibida)`. El porcentaje redondeado acota `conRespuesta`.
 * - Los porcentajes por etapa acotan su celda a partir del total.
 */

/** min ≤ Σ celdas ≤ max. */
export interface Desigualdad {
  celdas: readonly string[];
  min: number;
  max: number;
}

const ETAPA_INICIAL: Etapa = "recibida";

const alcanzables = (desde: Etapa, evitando: Etapa | null): Set<Etapa> => {
  const vistas = new Set<Etapa>();
  if (desde === evitando) return vistas;
  const pendientes: Etapa[] = [desde];
  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    if (actual === undefined || vistas.has(actual)) continue;
    vistas.add(actual);
    for (const siguiente of TRANSICIONES[actual]) {
      if (siguiente !== evitando) pendientes.push(siguiente);
    }
  }
  return vistas;
};

/** Etapas sucesoras de `etapa`, y las que solo se alcanzan pasando por ella. */
export const sucesoras = (etapa: Etapa): { todas: Etapa[]; soloPorElla: Etapa[] } => {
  const todas = [...alcanzables(etapa, null)].filter((e) => e !== etapa);
  const sinElla = alcanzables(ETAPA_INICIAL, etapa);
  return { todas, soloPorElla: todas.filter((e) => !sinElla.has(e)) };
};

const rangoDePorcentaje = (porcentaje: number, total: number): Cota => ({
  min: Math.max(0, Math.ceil(((porcentaje - 0.5) / 100) * total)),
  max: Math.min(total, Math.floor(((porcentaje + 0.5) / 100) * total)),
});

/**
 * Desigualdades que el indicador de un ente revela sobre sus celdas. Solo cuando `motivo` es
 * "publicado" un valor ausente dice algo: en los demás casos el ente se ocultó entero por una
 * regla visible, así que la ausencia no depende de las cifras.
 */
export const desigualdadesDeIndicador = (indicador: IndicadoresEnte, k: number): Desigualdad[] => {
  const { ente, denuncias: total } = indicador;
  if (indicador.motivo !== "publicado" || total === null) return [];
  const celda = (etapa: Etapa): string => idDeClaves({ ente, etapa });
  const resultado: Desigualdad[] = [];

  for (const etapa of CLAVES_ETAPA) {
    const { todas, soloPorElla } = sucesoras(etapa);
    if (todas.length === 0) continue;
    const tiempo = indicador.tiempoPromedioDias[etapa];
    if (tiempo === undefined || tiempo === null) {
      // Menos de k salidas: las etapas que solo se alcanzan por esta suman menos de k.
      if (soloPorElla.length > 0) {
        resultado.push({ celdas: soloPorElla.map(celda), min: 0, max: k - 1 });
      }
    } else {
      resultado.push({ celdas: todas.map(celda), min: k, max: Infinity });
    }
  }

  const porcentajes: [number | null, Etapa, boolean][] = [
    [indicador.porcentajeTurnado, "recibida", true],
    [indicador.porcentajeArchivado, "archivada", false],
    [indicador.porcentajeSinCompetencia, "sin_competencia", false],
  ];
  for (const [porcentaje, etapa, complemento] of porcentajes) {
    if (porcentaje === null) continue;
    const rango = rangoDePorcentaje(porcentaje, total);
    resultado.push(
      complemento
        ? { celdas: [celda(etapa)], min: total - rango.max, max: total - rango.min }
        : { celdas: [celda(etapa)], min: rango.min, max: rango.max },
    );
  }

  if (indicador.porcentajeConRespuesta !== null) {
    const respondidas = rangoDePorcentaje(indicador.porcentajeConRespuesta, total);
    // conRespuesta ≥ total − recibida  ⇒  recibida ≥ total − conRespuesta.
    resultado.push({ celdas: [celda("recibida")], min: total - respondidas.max, max: Infinity });
  }
  return resultado;
};

/** Estrecha las cotas con una desigualdad. Devuelve true si cambió algo; lanza si es inviable. */
const aplicar = (cotas: Map<string, Cota>, { celdas, min, max }: Desigualdad): boolean => {
  let cambio = false;
  for (const id of celdas) {
    const cota = cotas.get(id);
    if (!cota) continue;
    const otras = celdas.filter((otra) => otra !== id);
    const restoMin = otras.reduce((s, otra) => s + (cotas.get(otra)?.min ?? 0), 0);
    const restoMax = otras.reduce((s, otra) => s + (cotas.get(otra)?.max ?? Infinity), 0);
    const nuevoMax = max - restoMin;
    const nuevoMin = min - restoMax;
    if (nuevoMax < cota.max) {
      cota.max = nuevoMax;
      cambio = true;
    }
    if (nuevoMin > cota.min) {
      cota.min = nuevoMin;
      cambio = true;
    }
    if (cota.min > cota.max) throw new Error(`Lo publicado es incoherente en ${id}`);
  }
  return cambio;
};

/**
 * Cotas del atacante que combina tablas e indicadores. Parte de las cotas del atacante por
 * intervalos y alterna desigualdades y propagación por líneas hasta un punto fijo.
 */
export const acotarConIndicadores = (
  vista: Vista,
  lineas: readonly Linea[],
  indicadores: readonly IndicadoresEnte[],
  k: number,
): Map<string, Cota> => {
  const cotas = acotarPorIntervalos(vista, lineas, k);
  const desigualdades = indicadores
    .flatMap((i) => desigualdadesDeIndicador(i, k))
    .filter((d) => d.celdas.every((id) => cotas.has(id)));
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const d of desigualdades) {
      if (aplicar(cotas, d)) cambio = true;
    }
    if (cambio && !propagar(cotas, lineas)) {
      throw new Error("Lo publicado es incoherente con sus líneas");
    }
  }
  return cotas;
};
