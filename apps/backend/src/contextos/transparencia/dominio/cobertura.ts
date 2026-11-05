import { ESTADOS, type FilaCobertura, type RespuestaCoberturaPdn } from "@dataton/shared";

/**
 * Cobertura de la PDN: qué registros del catálogo oficial aparecen como conectados a cada sistema.
 * Mide información disponible, nunca conducta, y describe entes, no denuncias ni personas: queda
 * fuera del motor de k-anonimato.
 *
 * El significado sale del tablero público de Cobertura (leyenda y filtros de su JS):
 * - `controlOIC`: órgano interno de control; se le pide solo S3.
 * - `controlTribunal`: tribunal de justicia administrativa; se le piden todos.
 * - los demás son sujetos obligados; se les piden S1, S2 y S6, nunca S3.
 */
export interface EnteCatalogo {
  ambitoGobierno: string;
  controlOIC: boolean;
  controlTribunal: boolean;
  sistema1: boolean;
  sistema2: boolean;
  sistema3: boolean;
  sistema6: boolean;
  entidad: string;
  date_created: string;
  date_updated: string | null;
}

export type AgregadoCobertura = Pick<
  RespuestaCoberturaPdn,
  | "ultimaModificacion"
  | "banderasFueraDeAlcance"
  | "nacional"
  | "porAmbito"
  | "porEntidad"
  | "porEntidadAmbito"
>;

const AMBITOS = ["Federal", "Estatal", "Municipal"] as const;
const CLAVE_FEDERACION = "00";
const BANDERAS = [
  "controlOIC",
  "controlTribunal",
  "sistema1",
  "sistema2",
  "sistema3",
  "sistema6",
] as const;
const SISTEMAS = [
  ["s1", "sistema1"],
  ["s2", "sistema2"],
  ["s3", "sistema3"],
  ["s6", "sistema6"],
] as const;

const nombreEntidad = (clave: string): string | undefined =>
  clave === CLAVE_FEDERACION ? "Federación" : ESTADOS[clave as keyof typeof ESTADOS];

/** Un valor inesperado detiene la regeneración: mejor un error que un porcentaje falso. */
const validar = (ente: EnteCatalogo): void => {
  for (const bandera of BANDERAS) {
    if (typeof ente[bandera] !== "boolean") {
      throw new Error(`Bandera no booleana en el catálogo: ${bandera}`);
    }
  }
  if (ente.controlOIC && ente.controlTribunal) {
    throw new Error("Registro marcado como órgano de control y tribunal a la vez");
  }
  if (nombreEntidad(ente.entidad) === undefined) {
    throw new Error(`Clave de entidad desconocida: ${String(ente.entidad)}`);
  }
  if (!(AMBITOS as readonly string[]).includes(ente.ambitoGobierno)) {
    throw new Error(`Valor de ámbito desconocido: ${String(ente.ambitoGobierno)}`);
  }
};

const seLePide = (
  ente: EnteCatalogo,
  sistema: "sistema1" | "sistema2" | "sistema3" | "sistema6",
) => (sistema === "sistema3" ? ente.controlOIC || ente.controlTribunal : !ente.controlOIC);

const unDecimal = (parte: number, total: number): number | null =>
  total === 0 ? null : Math.round((parte / total) * 1000) / 10;

const construirFila = (
  entes: readonly EnteCatalogo[],
  rotulo: Pick<FilaCobertura, "entidad" | "ambito" | "nombre">,
): FilaCobertura => {
  const conexion = (sistema: (typeof SISTEMAS)[number][1]) => {
    const aplicables = entes.filter((e) => seLePide(e, sistema));
    const conectados = aplicables.filter((e) => e[sistema]).length;
    return {
      aplicables: aplicables.length,
      conectados,
      porcentaje: unDecimal(conectados, aplicables.length),
    };
  };
  const sinConexion = entes.filter(
    (e) => !SISTEMAS.some(([, sistema]) => seLePide(e, sistema) && e[sistema]),
  ).length;
  return {
    ...rotulo,
    registros: entes.length,
    sujetosObligados: entes.filter((e) => !e.controlOIC && !e.controlTribunal).length,
    organosControl: entes.filter((e) => e.controlOIC).length,
    tribunales: entes.filter((e) => e.controlTribunal).length,
    s1: conexion("sistema1"),
    s2: conexion("sistema2"),
    s3: conexion("sistema3"),
    s6: conexion("sistema6"),
    sinConexion,
    porcentajeSinConexion: unDecimal(sinConexion, entes.length),
  };
};

const agrupar = <K extends string>(
  entes: readonly EnteCatalogo[],
  clave: (ente: EnteCatalogo) => K,
): Map<K, EnteCatalogo[]> => {
  const grupos = new Map<K, EnteCatalogo[]>();
  for (const ente of entes) {
    const k = clave(ente);
    grupos.set(k, [...(grupos.get(k) ?? []), ente]);
  }
  return grupos;
};

export const agregarCobertura = (entes: readonly EnteCatalogo[]): AgregadoCobertura => {
  entes.forEach(validar);

  const entidades = [...new Set(entes.map((e) => e.entidad))].sort();
  const porEntidadGrupo = agrupar(entes, (e) => e.entidad);
  const porAmbitoGrupo = agrupar(entes, (e) => e.ambitoGobierno);
  const fechas = entes.map((e) => e.date_updated ?? e.date_created).sort();

  return {
    ultimaModificacion: (fechas.at(-1) ?? "").slice(0, 10),
    banderasFueraDeAlcance: entes.reduce(
      (suma, e) =>
        suma + SISTEMAS.filter(([, sistema]) => e[sistema] && !seLePide(e, sistema)).length,
      0,
    ),
    nacional: construirFila(entes, { entidad: null, ambito: null, nombre: "Nacional" }),
    porAmbito: AMBITOS.flatMap((ambito) => {
      const grupo = porAmbitoGrupo.get(ambito);
      return grupo ? [construirFila(grupo, { entidad: null, ambito, nombre: ambito })] : [];
    }),
    porEntidad: entidades.map((entidad) =>
      construirFila(porEntidadGrupo.get(entidad) ?? [], {
        entidad,
        ambito: null,
        nombre: nombreEntidad(entidad) ?? entidad,
      }),
    ),
    porEntidadAmbito: entidades.flatMap((entidad) =>
      AMBITOS.flatMap((ambito) => {
        const grupo = (porEntidadGrupo.get(entidad) ?? []).filter(
          (e) => e.ambitoGobierno === ambito,
        );
        return grupo.length === 0
          ? []
          : [construirFila(grupo, { entidad, ambito, nombre: nombreEntidad(entidad) ?? entidad })];
      }),
    ),
  };
};

/**
 * Las banderas no son una prueba de que lleguen datos, ni su ausencia de que no lleguen. Sin cruzar
 * nombres, compara por estado lo que marca el catálogo con lo que trae la instantánea de S3.
 */
export const contrastarConS3 = (
  porEntidad: readonly FilaCobertura[],
  registrosS3: readonly { estado: string; registros: number }[],
): RespuestaCoberturaPdn["contrasteS3"] => {
  const conRegistros = new Map(registrosS3.map((f) => [f.estado, f.registros]));
  const estados = porEntidad.filter((f) => f.entidad !== null && f.entidad !== CLAVE_FEDERACION);
  return {
    conRegistrosSinConexion: estados.flatMap((f) => {
      const registros = conRegistros.get(f.entidad ?? "") ?? 0;
      return registros > 0 && f.s3.conectados === 0 ? [{ estado: f.entidad ?? "", registros }] : [];
    }),
    conConexionSinRegistros: estados.flatMap((f) =>
      f.s3.conectados > 0 && !conRegistros.has(f.entidad ?? "")
        ? [{ estado: f.entidad ?? "", conectados: f.s3.conectados }]
        : [],
    ),
  };
};

export const AVISOS_COBERTURA = [
  "Una bandera dice que el catálogo marca el registro como conectado. No dice cuántos datos llegan, ni si están completos o al día.",
  "Según el tablero de Cobertura, la información la aportan las Secretarías Ejecutivas de los Sistemas Estatales Anticorrupción, y SESNA no responde por su veracidad, exactitud o actualización. Para aclarar el dato de un estado, hay que acudir a su Secretaría Ejecutiva.",
  "Un registro no es una institución: muchas aparecen dos veces, como sujeto obligado y como su órgano interno de control. Por eso cada sistema se mide solo sobre los registros a los que se les pide.",
  "El porcentaje solo considera lo que lista el catálogo. Un ente que no esté en la lista no cuenta como pendiente.",
  "No se publica el nombre de ningún ente: el catálogo es público, pero esta lectura compara estados y ámbitos, no instituciones.",
];

const COLUMNAS_CSV = [
  "corte",
  "entidad",
  "ambito",
  "nombre",
  "registros",
  "sujetos_obligados",
  "organos_control",
  "tribunales",
  ...SISTEMAS.flatMap(([s]) => [`${s}_aplicables`, `${s}_conectados`, `${s}_porcentaje`]),
  "sin_conexion",
  "sin_conexion_porcentaje",
  "consultado_el",
  "datos_sinteticos",
  "k_anonimato",
];

const celdaCsv = (valor: string | number | null): string => {
  const texto = valor === null ? "" : String(valor);
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

export const comoCsvCobertura = (agregado: AgregadoCobertura, consultadoEl: string): string => {
  const linea = (corte: string, fila: FilaCobertura): string =>
    [
      corte,
      fila.entidad,
      fila.ambito,
      fila.nombre,
      fila.registros,
      fila.sujetosObligados,
      fila.organosControl,
      fila.tribunales,
      ...SISTEMAS.flatMap(([s]) => [fila[s].aplicables, fila[s].conectados, fila[s].porcentaje]),
      fila.sinConexion,
      fila.porcentajeSinConexion,
      consultadoEl,
      "false",
      "no_aplica",
    ]
      .map(celdaCsv)
      .join(",");
  return `${[
    COLUMNAS_CSV.join(","),
    linea("nacional", agregado.nacional),
    ...agregado.porAmbito.map((f) => linea("ambito", f)),
    ...agregado.porEntidad.map((f) => linea("entidad", f)),
    ...agregado.porEntidadAmbito.map((f) => linea("entidad_ambito", f)),
  ].join("\n")}\n`;
};
