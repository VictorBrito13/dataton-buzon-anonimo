// Datos abiertos simulados para revisar el tablero. Cifras inventadas: lo que importa aquí son los
// casos que tensan el diseño, como nombres largos, celdas ocultas y las 16 columnas de cruce.
import {
  CLAVES_ESTADO,
  CLAVES_ETAPA,
  CLAVES_TIPO_FALTA,
  ENTES_SINTETICOS,
  ESTADOS,
  respuestaAgregados,
  respuestaCoberturaPdn,
  respuestaIndicadores,
  respuestaMetodologia,
  respuestaMunicipios,
  respuestaPdn,
  respuestaPeriodos,
} from "@dataton/shared";

const K = 5;
const PERIODO = "2026-T3";
const INSTITUCION_LARGA =
  "SECRETARÍA DE ADMINISTRACIÓN Y FINANZAS DEL PODER EJECUTIVO DEL ESTADO LIBRE Y SOBERANO";

/** Conteo estable por posición, con una celda menor a k y otra con supresión complementaria. */
const celda = (claves, i) => {
  if (i % 7 === 3) return { claves, conteo: null, motivo: "menor_a_k" };
  if (i % 7 === 5) return { claves, conteo: null, motivo: "supresion_complementaria" };
  return { claves, conteo: (i * 37) % 1200, motivo: "publicada" };
};

const agregados = (dimensiones, celdas) =>
  respuestaAgregados.parse({ k: K, periodo: PERIODO, dimensiones, celdas, total: 12480 });

const CELDAS = {
  estado: CLAVES_ESTADO.map((estado, i) => celda({ estado }, i)),
  tipoFalta: CLAVES_TIPO_FALTA.map((tipoFalta, i) => celda({ tipoFalta }, i)),
  etapa: CLAVES_ETAPA.map((etapa, i) => celda({ etapa }, i)),
  municipio: Array.from({ length: 12 }, (_, i) =>
    celda({ municipio: `17${String(i + 1).padStart(3, "0")}` }, i + 1),
  ),
  "tipoFalta,etapa": CLAVES_TIPO_FALTA.slice(0, 6).flatMap((tipoFalta, i) =>
    CLAVES_ETAPA.map((etapa, j) => celda({ tipoFalta, etapa }, i * 11 + j)),
  ),
};

const metodologia = respuestaMetodologia.parse({
  k: K,
  anchoMinimo: 3,
  rezagoDias: 90,
  datosSinteticos: true,
  reglas: ["Ninguna cifra menor que k se publica.", "Cada periodo publicado no cambia."],
  garantia: "Ninguna celda publicada permite deducir un conteo menor que k.",
  noCubre: ["Lo que la propia persona cuente en otro lado."],
  alcanceCobertura: "El k-anonimato no aplica a la cobertura de la PDN.",
  ejemploAtaque: {
    original: [
      { municipio: "A", cohecho: 5, abuso: 7, total: 12 },
      { municipio: "B", cohecho: 3, abuso: 5, total: 8 },
      { municipio: "C", cohecho: 1, abuso: 8, total: 9 },
    ],
    protegida: [
      { municipio: "A", cohecho: null, abuso: null, total: 12 },
      { municipio: "B", cohecho: 3, abuso: 5, total: 8 },
      { municipio: "C", cohecho: null, abuso: null, total: 9 },
    ],
    rango: { min: 1, max: 4 },
    valorReal: 1,
  },
  tablas: ["estado", "tipoFalta"],
});

const indicadores = respuestaIndicadores.parse({
  k: K,
  periodo: PERIODO,
  datosSinteticos: true,
  aviso: "Una señal para priorizar la revisión, nunca una acusación.",
  entes: ENTES_SINTETICOS.map(({ id, etiqueta }, i) => ({
    ente: id,
    etiqueta,
    motivo: i === 7 ? "menor_a_k" : "publicado",
    denuncias: i === 7 ? null : 400 - i * 40,
    porcentajeConRespuesta: i === 7 ? null : 90 - i * 10,
    porcentajeTurnado: i === 7 ? null : 60,
    porcentajeArchivado: i === 7 ? null : 12,
    porcentajeSinCompetencia: i === 7 ? null : 8,
    tiempoPromedioDias: { recibida: 3, en_investigacion: i === 7 ? null : 41 },
    senal: i === 7 ? "datos_insuficientes" : i % 3 === 0 ? "priorizar_revision" : "sin_senal",
  })),
});

const pdn = (estado) =>
  respuestaPdn.parse({
    fuentes: [
      {
        nombre: "S3 de la Plataforma Digital Nacional",
        url: "https://datos.ejemplo.invalid/ruta/muy/larga/sin/espacios/para/forzar/el/ajuste/de/linea/s3.zip",
        consultadoEl: "2026-10-01",
        licencia: "CC BY 4.0.",
        cobertura: "Cobertura incompleta.",
      },
    ],
    advertencias: ["Cobertura incompleta: no todos los estados reportan.", "S6 llega hasta 2021."],
    s3: {
      umbralPorInstitucion: K,
      registrosSinInstitucion: 1204,
      registrosConNombreNoInterpretable: 87,
      porEstado: CLAVES_ESTADO.slice(0, 8).map((clave, i) => ({
        estado: clave,
        registros: 900 - i * 80,
        instituciones: 40 - i,
      })),
      instituciones: estado
        ? [
            { nombre: INSTITUCION_LARGA, conteo: 120 },
            { nombre: "AYUNTAMIENTO DE CUERNAVACA", conteo: null },
          ]
        : [],
    },
    s6: {
      compradores: 2300,
      procedimientos: 481200,
      mayores: [
        { nombre: INSTITUCION_LARGA, procedimientos: 18200 },
        { nombre: "Instituto de Seguridad Social", procedimientos: 9100 },
      ],
    },
    cruce: {
      coincidencias: [
        { nombre: INSTITUCION_LARGA, estado: "17", sanciones: null, procedimientos: 42 },
      ],
      homonimosDescartados: 3,
      sinJurisdiccionConocida: 11,
    },
  });

const periodos = respuestaPeriodos.parse({
  periodos: [
    { periodo: PERIODO, k: K },
    { periodo: "2025-T4", k: K },
  ],
  rezagoDias: 90,
  datosSinteticos: true,
});

const municipios = respuestaMunicipios.parse({
  municipios: Array.from({ length: 12 }, (_, i) => ({
    clave: `17${String(i + 1).padStart(3, "0")}`,
    nombre: i === 0 ? "Cuernavaca" : `Municipio con un nombre bastante largo número ${i + 1}`,
  })),
  fuente: "Catálogo del Marco Geoestadístico de INEGI.",
});

const conexion = (aplicables, conectados) => ({
  aplicables,
  conectados,
  porcentaje: aplicables === 0 ? null : Math.round((conectados / aplicables) * 1000) / 10,
});

/** Tensa el ancho de la tabla: miles, un cero, un denominador bajo y un sistema sin aplicables. */
const filaCobertura = (entidad, ambito, nombre, i) => ({
  entidad,
  ambito,
  nombre,
  registros: 12_400 + i,
  sujetosObligados: 7_000,
  organosControl: 5_000,
  tribunales: 400 + i,
  s1: conexion(7_400, i % 3 === 0 ? 0 : 3_700 + i),
  s2: conexion(7_400, i * 200),
  s3: conexion(i % 5 === 1 ? 1 : 5_400, 0),
  s6: conexion(i % 7 === 2 ? 0 : 7_400, 0),
  sinConexion: 6_000,
  porcentajeSinConexion: 48.4,
});

const cobertura = respuestaCoberturaPdn.parse({
  fuente: {
    nombre: "Cobertura de la PDN",
    url: "https://datos.ejemplo.invalid/ruta/muy/larga/sin/espacios/para/forzar/el/ajuste/de/linea/entes",
    consultadoEl: "2026-11-05",
    licencia: "No encontrada. Pendiente de confirmar con SESNA.",
  },
  datosSinteticos: false,
  kAnonimato: "no_aplica",
  avisos: ["Una bandera dice que el catálogo marca el registro como conectado."],
  ultimaModificacion: "2026-10-21",
  banderasFueraDeAlcance: 0,
  nacional: filaCobertura(null, null, "Nacional", 4),
  porAmbito: ["Federal", "Estatal", "Municipal"].map((a, i) => filaCobertura(null, a, a, i + 1)),
  porEntidad: [
    filaCobertura("00", null, "Federación", 4),
    ...CLAVES_ESTADO.map((estado, i) => filaCobertura(estado, null, ESTADOS[estado], i)),
  ],
  porEntidadAmbito: [],
  contrasteS3: {
    conRegistrosSinConexion: [{ estado: "29", registros: 77 }],
    conConexionSinRegistros: [{ estado: "04", conectados: 1 }],
  },
});

/** Responde a /publico/*; devuelve undefined si la ruta no corresponde. */
export const responderPublico = (ruta, parametros) => {
  if (ruta === "/publico/cobertura-pdn") return cobertura;
  if (ruta === "/publico/periodos") return periodos;
  if (ruta === "/publico/metodologia") return metodologia;
  if (ruta === "/publico/indicadores") return indicadores;
  if (ruta === "/publico/pdn") return pdn(parametros.get("estado"));
  if (ruta === "/publico/catalogos/municipios") return municipios;
  if (ruta === "/publico/agregados") {
    const dimensiones = parametros.get("dimensiones") ?? "";
    return agregados(dimensiones.split(","), CELDAS[dimensiones] ?? []);
  }
  return undefined;
};
