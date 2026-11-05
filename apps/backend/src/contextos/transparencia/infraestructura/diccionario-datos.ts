import { DETALLE_SISTEMAS } from "@dataton/shared";

/** Diccionario de los datos abiertos (HU-33). */
export const DICCIONARIO_DATOS = {
  descripcion:
    "Conteos de denuncias por trimestre cerrado, protegidos con k-anonimato. En este prototipo todas las denuncias son sintéticas.",
  licencia: "CC BY-NC, igual que el proyecto.",
  campos: [
    { campo: "periodo", tipo: "texto", descripcion: "Trimestre cerrado, como 2026-T3." },
    {
      campo: "tabla",
      tipo: "texto",
      descripcion:
        "Dimensiones de la fila, unidas con *. `total` es el total nacional del trimestre.",
    },
    { campo: "estado", tipo: "texto", descripcion: "Clave de entidad del Marco Geoestadístico." },
    {
      campo: "municipio",
      tipo: "texto",
      descripcion:
        "Clave de cinco dígitos: estado y municipio. Terminada en 999: denuncias del estado sin municipio.",
    },
    { campo: "tipoFalta", tipo: "texto", descripcion: "Clave del catálogo de tipos de falta." },
    { campo: "etapa", tipo: "texto", descripcion: "Etapa vigente en la fecha de corte." },
    {
      campo: "ente",
      tipo: "texto",
      descripcion:
        "Identificador del ente; los `ficticio-*` no corresponden a ninguna institución real. `sin_especificar`: la denuncia no indicó ente.",
    },
    {
      campo: "conteo",
      tipo: "entero o vacío",
      descripcion: "Número de denuncias. Vacío si la celda está oculta: el valor nunca se publica.",
    },
    {
      campo: "motivo",
      tipo: "texto",
      descripcion:
        "`publicada`; `menor_a_k`: hay entre 1 y k − 1; `supresion_complementaria`: se oculta para impedir deducir otra celda.",
    },
    { campo: "k", tipo: "entero", descripcion: "Umbral vigente al publicar el trimestre." },
    {
      campo: "datos_sinteticos",
      tipo: "booleano",
      descripcion: "`true` si las denuncias de origen provienen del generador sintético.",
    },
  ],
  notas: [
    "Un trimestre publicado no se recalcula.",
    "La etapa se toma en la fecha de corte: el cierre del trimestre más el rezago.",
    "Los conteos de la PDN por institución son otra fuente, real, y se consultan aparte.",
  ],
  /** Otro conjunto, en /descargas/cobertura-pdn.csv y .json. */
  cobertura: {
    descripcion:
      "Cobertura de la PDN: información de entes públicos, no de denuncias ni de personas. Dice qué registros del catálogo oficial aparecen como conectados a S1, S2, S3 y S6. Son datos reales y mide información disponible, no conducta.",
    licencia: "No encontrada. Pendiente de confirmar con SESNA.",
    campos: [
      {
        campo: "corte",
        tipo: "texto",
        descripcion: "`nacional`, `ambito`, `entidad` o `entidad_ambito`.",
      },
      {
        campo: "entidad",
        tipo: "texto o vacío",
        descripcion:
          "Clave de entidad federativa del catálogo; `00` es la Federación y coincide siempre con el ámbito federal. Es la jurisdicción del ente, no el domicilio de sus oficinas.",
      },
      { campo: "ambito", tipo: "texto o vacío", descripcion: "Federal, Estatal o Municipal." },
      { campo: "nombre", tipo: "texto", descripcion: "Nombre del corte, nunca de un ente." },
      {
        campo: "registros",
        tipo: "entero",
        descripcion:
          "Filas del catálogo. Una institución puede aparecer dos veces: como sujeto obligado y como su órgano interno de control.",
      },
      {
        campo: "sujetos_obligados",
        tipo: "entero",
        descripcion:
          "Registros con `controlOIC` y `controlTribunal` falsos. Se les piden S1, S2 y S6.",
      },
      {
        campo: "organos_control",
        tipo: "entero",
        descripcion: "Registros con `controlOIC` verdadero. Se les pide solo S3.",
      },
      {
        campo: "tribunales",
        tipo: "entero",
        descripcion: "Registros con `controlTribunal` verdadero. Se les piden todos los sistemas.",
      },
      ...(["s1", "s2", "s3", "s6"] as const).flatMap((sistema) => [
        {
          campo: `${sistema}_aplicables`,
          tipo: "entero",
          descripcion: `Registros a los que se les pide ${sistema.toUpperCase()}: ${DETALLE_SISTEMAS[sistema].seLePideA}. ${DETALLE_SISTEMAS[sistema].descripcion}`,
        },
        {
          campo: `${sistema}_conectados`,
          tipo: "entero",
          descripcion: `De los anteriores, los que el catálogo marca como conectados a ${sistema.toUpperCase()}.`,
        },
        {
          campo: `${sistema}_porcentaje`,
          tipo: "decimal o vacío",
          descripcion: "Conectados entre aplicables, a un decimal. Vacío si no hay aplicables.",
        },
      ]),
      {
        campo: "sin_conexion",
        tipo: "entero",
        descripcion: "Registros sin bandera en ninguno de los sistemas que se les piden.",
      },
      {
        campo: "sin_conexion_porcentaje",
        tipo: "decimal",
        descripcion: "Sin conexión entre registros, a un decimal.",
      },
      { campo: "consultado_el", tipo: "fecha", descripcion: "Día de la descarga del catálogo." },
      {
        campo: "datos_sinteticos",
        tipo: "booleano",
        descripcion: "Siempre `false`: este conjunto es real.",
      },
      {
        campo: "k_anonimato",
        tipo: "texto",
        descripcion: "Siempre `no_aplica`: son conteos de entes públicos, no de denuncias.",
      },
    ],
    notas: [
      "Una bandera falsa no significa que el ente no tenga sanciones, declaraciones o contratos: significa que, según el catálogo, esos datos no llegan a la PDN.",
      "Tampoco mide conducta ni riesgo de corrupción: sirve para priorizar la integración de datos.",
      "El significado de los tipos y sistemas proviene de la leyenda y los filtros del tablero público de Cobertura; no hay un diccionario oficial publicado.",
    ],
  },
};
