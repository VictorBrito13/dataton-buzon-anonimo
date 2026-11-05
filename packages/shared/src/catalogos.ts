/**
 * Catálogos compartidos. Las claves son estables: se guardan en la base de datos
 * y se publican en los datos abiertos. Las etiquetas están en lenguaje claro.
 */

/** Flujo habitual en los órganos internos de control (propuesta, sección 8). */
export const ETAPAS = {
  recibida: {
    etiqueta: "Recibida",
    explicacion: "Tu denuncia llegó y está en espera de ser asignada.",
    plazoEsperado: "Hasta 5 días hábiles",
    terminal: false,
  },
  turnada_investigadora: {
    etiqueta: "Turnada a investigación",
    explicacion: "Se envió a la autoridad que puede investigar los hechos.",
    plazoEsperado: "Hasta 10 días hábiles",
    terminal: false,
  },
  analisis_competencia: {
    etiqueta: "Revisión de competencia",
    explicacion: "La autoridad revisa si le corresponde atender el caso.",
    plazoEsperado: "Hasta 15 días hábiles",
    terminal: false,
  },
  en_investigacion: {
    etiqueta: "En investigación",
    explicacion: "La autoridad reúne pruebas sobre los hechos que describiste.",
    plazoEsperado: "Variable; puede tomar varios meses",
    terminal: false,
  },
  sin_competencia: {
    etiqueta: "Enviada a otra autoridad",
    explicacion: "La autoridad determinó que el caso le corresponde a otra instancia.",
    plazoEsperado: "Concluye en esta instancia",
    terminal: true,
  },
  archivada: {
    etiqueta: "Archivada",
    explicacion: "La autoridad concluyó sin encontrar elementos para continuar.",
    plazoEsperado: "Concluye en esta instancia",
    terminal: true,
  },
  substanciacion: {
    etiqueta: "En substanciación",
    explicacion:
      "Se encontró presunta responsabilidad y el caso pasó a la autoridad substanciadora.",
    plazoEsperado: "Variable",
    terminal: false,
  },
  tribunal: {
    etiqueta: "En el Tribunal de Justicia Administrativa",
    explicacion: "El Tribunal revisa el caso y emitirá una resolución.",
    plazoEsperado: "Variable",
    terminal: false,
  },
  resuelta: {
    etiqueta: "Resuelta",
    explicacion: "La autoridad competente emitió una resolución.",
    plazoEsperado: "Concluida",
    terminal: true,
  },
} as const;

export type Etapa = keyof typeof ETAPAS;
export const CLAVES_ETAPA = Object.keys(ETAPAS) as [Etapa, ...Etapa[]];

/** Transiciones válidas; las usa el panel de autoridad y el generador sintético. */
export const TRANSICIONES: Record<Etapa, readonly Etapa[]> = {
  recibida: ["turnada_investigadora"],
  turnada_investigadora: ["analisis_competencia"],
  analisis_competencia: ["en_investigacion", "sin_competencia"],
  en_investigacion: ["substanciacion", "archivada"],
  sin_competencia: [],
  archivada: [],
  substanciacion: ["tribunal", "resuelta"],
  tribunal: ["resuelta"],
  resuelta: [],
};

/**
 * Basado en la Ley General de Responsabilidades Administrativas.
 * "abuso_funciones" es el nombre legal de lo que la propuesta llama "abuso de autoridad".
 * "hecho_corrupcion" cubre la tercera categoría del S5 y del reto de la convocatoria,
 * que distinguen faltas graves, faltas no graves y hechos de corrupción.
 * Se ajustará al catálogo de la PDN cuando se confirme.
 */
export const TIPOS_FALTA = {
  cohecho: { etiqueta: "Cohecho (pedir o aceptar sobornos)", gravedad: "grave" },
  peculado: { etiqueta: "Peculado (usar recursos públicos para fines propios)", gravedad: "grave" },
  desvio_recursos: { etiqueta: "Desvío de recursos públicos", gravedad: "grave" },
  abuso_funciones: { etiqueta: "Abuso de funciones", gravedad: "grave" },
  conflicto_interes: { etiqueta: "Actuar con conflicto de interés", gravedad: "grave" },
  contratacion_indebida: { etiqueta: "Contratación indebida", gravedad: "grave" },
  trafico_influencias: { etiqueta: "Tráfico de influencias", gravedad: "grave" },
  enriquecimiento_oculto: { etiqueta: "Enriquecimiento oculto", gravedad: "grave" },
  obstruccion_justicia: { etiqueta: "Obstrucción de la justicia", gravedad: "grave" },
  falta_no_grave: {
    etiqueta: "Incumplimiento de obligaciones (falta no grave)",
    gravedad: "no_grave",
  },
  falta_particulares: {
    etiqueta: "Falta cometida por particulares o empresas",
    gravedad: "particulares",
  },
  hecho_corrupcion: {
    etiqueta: "Posible hecho de corrupción (podría ser un delito)",
    gravedad: "hecho_corrupcion",
  },
  otra: { etiqueta: "Otra o no estoy seguro", gravedad: "sin_clasificar" },
} as const;

export type TipoFalta = keyof typeof TIPOS_FALTA;
export const CLAVES_TIPO_FALTA = Object.keys(TIPOS_FALTA) as [TipoFalta, ...TipoFalta[]];

/** Claves de entidad federativa del Marco Geoestadístico de INEGI. */
export const ESTADOS = {
  "01": "Aguascalientes",
  "02": "Baja California",
  "03": "Baja California Sur",
  "04": "Campeche",
  "05": "Coahuila de Zaragoza",
  "06": "Colima",
  "07": "Chiapas",
  "08": "Chihuahua",
  "09": "Ciudad de México",
  "10": "Durango",
  "11": "Guanajuato",
  "12": "Guerrero",
  "13": "Hidalgo",
  "14": "Jalisco",
  "15": "Estado de México",
  "16": "Michoacán de Ocampo",
  "17": "Morelos",
  "18": "Nayarit",
  "19": "Nuevo León",
  "20": "Oaxaca",
  "21": "Puebla",
  "22": "Querétaro",
  "23": "Quintana Roo",
  "24": "San Luis Potosí",
  "25": "Sinaloa",
  "26": "Sonora",
  "27": "Tabasco",
  "28": "Tamaulipas",
  "29": "Tlaxcala",
  "30": "Veracruz de Ignacio de la Llave",
  "31": "Yucatán",
  "32": "Zacatecas",
} as const;

export type ClaveEstado = keyof typeof ESTADOS;
export const CLAVES_ESTADO = Object.keys(ESTADOS) as [ClaveEstado, ...ClaveEstado[]];
