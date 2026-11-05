import { CLAVES_TIPO_FALTA, TRANSICIONES } from "@dataton/shared";
import type { Etapa, TipoFalta } from "@dataton/shared";
import { crearAzar, type Azar } from "../dominio/azar.js";
import { finDePeriodo, inicioDePeriodo } from "../dominio/periodo.js";

/**
 * Generador de denuncias SINTÉTICAS, determinista por semilla. Nada aquí describe hechos reales:
 * los entes son ficticios y la distribución solo imita una forma plausible. No contiene relatos,
 * nombres de personas ni instituciones reales.
 */

export interface EnteSintetico {
  id: string;
  peso: number;
  /** Probabilidad de que la autoridad responda y de que el caso avance, entre 0 y 1. */
  atencion?: number;
}

export interface Catalogo {
  municipios: readonly { clave: string; estado: string }[];
  /** Municipios con mucha más población: concentran denuncias. El resto sigue una cola larga. */
  municipiosGrandes: readonly string[];
  entes: readonly EnteSintetico[];
}

export interface OpcionesGenerador {
  semilla: number;
  desde: string;
  hasta: string;
  denunciasPorTrimestre: number;
  /** Ninguna etapa ocurre después de este día. */
  hoy: string;
}

export interface DenunciaSintetica {
  sintetica: true;
  estado: string;
  municipio: string | null;
  tipoFalta: TipoFalta;
  enteId: string | null;
  recibidaDia: string;
  etapas: { etapa: Etapa; dia: string }[];
  respuestaDia: string | null;
}

const PESO_GRANDE = 60;
const PROBABILIDAD_SIN_MUNICIPIO = 0.08;
const PROBABILIDAD_SIN_ENTE = 0.12;

const PESOS_TIPO: Readonly<Record<TipoFalta, number>> = {
  cohecho: 22,
  abuso_funciones: 20,
  falta_no_grave: 18,
  contratacion_indebida: 10,
  desvio_recursos: 8,
  peculado: 7,
  otra: 6,
  hecho_corrupcion: 5,
  conflicto_interes: 4,
  trafico_influencias: 2,
  falta_particulares: 2,
  enriquecimiento_oculto: 0.6,
  obstruccion_justicia: 0.4,
};

/** Días que suele durar cada etapa antes de pasar a la siguiente. */
const DURACION: Partial<Readonly<Record<Etapa, readonly [number, number]>>> = {
  recibida: [1, 8],
  turnada_investigadora: [3, 15],
  analisis_competencia: [5, 25],
  en_investigacion: [30, 180],
  substanciacion: [30, 120],
  tribunal: [60, 200],
};

const PESOS_RAMA: Partial<Readonly<Record<Etapa, number>>> = {
  en_investigacion: 75,
  sin_competencia: 25,
  substanciacion: 25,
  archivada: 75,
  tribunal: 30,
  resuelta: 70,
};

const sumarDias = (dia: string, dias: number): string => {
  const fecha = new Date(`${dia}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

const diasEntre = (desde: string, hasta: string): number =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

/** Tabla acumulada para elegir entre miles de opciones sin recorrerlas todas. */
const crearSorteo = <T>(opciones: readonly (readonly [T, number])[]) => {
  const acumulado: number[] = [];
  let total = 0;
  for (const [, peso] of opciones) {
    total += peso;
    acumulado.push(total);
  }
  return (azar: Azar): T => {
    const objetivo = azar.real() * total;
    let bajo = 0;
    let alto = acumulado.length - 1;
    while (bajo < alto) {
      const medio = (bajo + alto) >> 1;
      if ((acumulado[medio] ?? 0) <= objetivo) bajo = medio + 1;
      else alto = medio;
    }
    const opcion = opciones[bajo];
    if (!opcion) throw new Error("Sorteo sin opciones");
    return opcion[0];
  };
};

/** Cola larga: dentro de cada estado, pocos municipios medianos y muchos con muy pocos casos. */
const pesosDeMunicipio = (catalogo: Catalogo, azar: Azar) => {
  const grandes = new Set(catalogo.municipiosGrandes);
  const rangoPorEstado = new Map<string, number>();
  const barajados = catalogo.municipios
    .map((m) => ({ ...m, orden: azar.real() }))
    .sort((a, b) => a.orden - b.orden);
  return barajados.map((m) => {
    if (grandes.has(m.clave)) return [m, PESO_GRANDE] as const;
    const rango = (rangoPorEstado.get(m.estado) ?? 0) + 1;
    rangoPorEstado.set(m.estado, rango);
    return [m, 3 / rango] as const;
  });
};

const recorrerEtapas = (
  recibidaDia: string,
  atencion: number,
  hoy: string,
  azar: Azar,
): DenunciaSintetica["etapas"] => {
  const etapas: DenunciaSintetica["etapas"] = [{ etapa: "recibida", dia: recibidaDia }];
  let actual: Etapa = "recibida";
  let dia = recibidaDia;
  for (;;) {
    const siguientes: readonly Etapa[] = TRANSICIONES[actual];
    if (siguientes.length === 0 || azar.real() > atencion) return etapas;
    const [minimo, maximo] = DURACION[actual] ?? [1, 30];
    const nuevoDia = sumarDias(dia, azar.entero(minimo, maximo));
    if (nuevoDia > hoy) return etapas;
    const elegida: Etapa = azar.ponderado(siguientes.map((e) => [e, PESOS_RAMA[e] ?? 1] as const));
    etapas.push({ etapa: elegida, dia: nuevoDia });
    actual = elegida;
    dia = nuevoDia;
  }
};

const trimestres = (desde: string, hasta: string): string[] => {
  const lista: string[] = [];
  let [anio, t] = desde.split("-T").map(Number) as [number, number];
  for (;;) {
    const periodo = `${anio}-T${t}`;
    lista.push(periodo);
    if (periodo === hasta) return lista;
    if (lista.length > 200) throw new Error(`Rango de periodos inválido: ${desde} a ${hasta}`);
    t += 1;
    if (t > 4) {
      t = 1;
      anio += 1;
    }
  }
};

export const generarDenunciasSinteticas = (
  catalogo: Catalogo,
  { semilla, desde, hasta, denunciasPorTrimestre, hoy }: OpcionesGenerador,
): DenunciaSintetica[] => {
  const azar = crearAzar(semilla);
  const municipio = crearSorteo(pesosDeMunicipio(catalogo, azar));
  const ente = crearSorteo(catalogo.entes.map((e) => [e, e.peso] as const));
  const tipos = CLAVES_TIPO_FALTA.map((t) => [t, PESOS_TIPO[t]] as const);

  const denuncias: DenunciaSintetica[] = [];
  for (const periodo of trimestres(desde, hasta)) {
    const inicio = inicioDePeriodo(periodo);
    const duracion = diasEntre(inicio, finDePeriodo(periodo));
    for (let i = 0; i < denunciasPorTrimestre; i += 1) {
      const lugar = municipio(azar);
      const elegido = ente(azar);
      const atencion = elegido.atencion ?? 0.8;
      const recibidaDia = sumarDias(inicio, azar.entero(0, duracion));
      const responde = azar.real() < atencion;
      const respuestaDia = sumarDias(recibidaDia, azar.entero(2, 25));
      denuncias.push({
        sintetica: true,
        estado: lugar.estado,
        municipio: azar.real() < PROBABILIDAD_SIN_MUNICIPIO ? null : lugar.clave,
        tipoFalta: azar.ponderado(tipos),
        enteId: azar.real() < PROBABILIDAD_SIN_ENTE ? null : elegido.id,
        recibidaDia,
        etapas: recorrerEtapas(recibidaDia, atencion, hoy, azar),
        respuestaDia: responde && respuestaDia <= hoy ? respuestaDia : null,
      });
    }
  }
  return denuncias;
};
