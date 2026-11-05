const METADATOS = /^(docProps|customXml)\//i;
/**
 * Partes incidentales que delatan el equipo: `printerSettings/` guarda binarios con el nombre de la
 * impresora y, a veces, de la red; `fonts/` lleva fuentes incrustadas, con licenciatario y
 * organización en sus tablas. El documento sigue abriendo sin ellas: Word y PowerPoint sustituyen la
 * fuente y Excel imprime con la impresora predeterminada.
 */
const INCIDENTALES = /(^|\/)(printerSettings|fonts)\//i;
const REFERENCIA_A_METADATOS = /(^|[/"])(docProps|customXml|printerSettings|fonts)\//i;

const PROHIBIDAS = [
  /vbaProject\.bin$/i,
  /vbaData\.xml$/i,
  /\/activeX\//i,
  /oleObject\d*\.bin$/i,
  /\.(exe|dll|bat|cmd|com|scr|ps1|js|vbs|jar|msi|sh)$/i,
];

export const esParteDeMetadatosOffice = (parte: string): boolean => METADATOS.test(parte);

export const esParteIncidentalOffice = (parte: string): boolean => INCIDENTALES.test(parte);

/** Todo lo que se retira del paquete antes de reescribirlo: metadatos e incidentales. */
export const esParteAQuitarOffice = (parte: string): boolean =>
  esParteDeMetadatosOffice(parte) || esParteIncidentalOffice(parte);

/** Macros y objetos activos: un archivo que los lleve no se acepta, aunque su tipo lo sea. */
export const esParteProhibidaOffice = (parte: string): boolean =>
  PROHIBIDAS.some((patron) => patron.test(parte));

/**
 * Evita que Office declare el archivo como dañado al faltarle partes referenciadas. Los `Default`
 * por extensión se conservan: no apuntan a ninguna parte.
 */
export const quitarReferenciasMetadatos = (xml: string): string =>
  xml.replace(/<(Relationship|Override)\b[^>]*\/>/g, (elemento) =>
    REFERENCIA_A_METADATOS.test(elemento) ? "" : elemento,
  );

export const ETIQUETAS_OFFICE = {
  rutas: "Rutas de archivos del equipo",
  rsids: "Identificadores de sesión de edición",
  autores: "Autores y fechas de comentarios y control de cambios",
  propiedades: "Propiedades",
  impresora: "Configuración de impresora",
  fuentes: "Fuentes incrustadas",
  imagenesNoLimpiables: "Imágenes en formatos que no se limpian",
  incrustadosNoLimpiables: "Documentos incrustados que no se limpian",
} as const;

/** Destino inofensivo: conserva el `Id` que otras partes referencian, sin revelar nada. */
const DESTINO_NEUTRO = "about:blank";

/** `file:`, `C:\…`, `\\servidor\…` y cualquier esquema que no sea http(s). */
const RUTA_LOCAL = /^(?:file:|[a-z]:[\\/]|\\\\|\/\/)/i;
const ESQUEMA_PERMITIDO = /^https?:\/\//i;

const destinoRevelador = (relacion: string): boolean => {
  const destino = /\bTarget="([^"]*)"/.exec(relacion)?.[1];
  if (destino === undefined || destino === DESTINO_NEUTRO) return false;
  if (RUTA_LOCAL.test(destino)) return true;
  const externa = /\bTargetMode="External"/i.test(relacion);
  return externa && !ESQUEMA_PERMITIDO.test(destino);
};

/**
 * Word y Excel guardan la ruta local de plantillas, vínculos y orígenes de datos, con el nombre
 * de usuario incluido. Se vacía el destino y se conserva la relación para no dejar `r:id` colgados.
 */
export const neutralizarRelacionesExternas = (xml: string): { xml: string; cambio: boolean } => {
  const salida = xml.replace(/<Relationship\b[^>]*\/>/g, (relacion) =>
    destinoRevelador(relacion)
      ? relacion.replace(/\bTarget="[^"]*"/, `Target="${DESTINO_NEUTRO}"`)
      : relacion,
  );
  return { xml: salida, cambio: salida !== xml };
};

const ANONIMO = "Anónimo";
const FECHA_NEUTRA = "2000-01-01T00:00:00Z";

interface Regla {
  parte: RegExp;
  etiqueta: string;
  aplicar: (xml: string) => string;
}

const REGLAS: readonly Regla[] = [
  {
    parte: /^word\/.*\.xml$/i,
    etiqueta: ETIQUETAS_OFFICE.autores,
    aplicar: (xml) =>
      xml
        .replace(/\b(w\d*:author)="[^"]*"/g, `$1="${ANONIMO}"`)
        .replace(/\b(w\d*:initials)="[^"]*"/g, '$1=""')
        .replace(/\b(w\d*:date|w\d*:dateUtc)="[^"]*"/g, `$1="${FECHA_NEUTRA}"`)
        .replace(/\b(w\d*:(?:userId|providerId))="[^"]*"/g, '$1=""'),
  },
  {
    parte: /^xl\/(comments|threadedComments|persons)/i,
    etiqueta: ETIQUETAS_OFFICE.autores,
    aplicar: (xml) =>
      xml
        .replace(/<author>[^<]*<\/author>/g, `<author>${ANONIMO}</author>`)
        .replace(/\b(displayName)="[^"]*"/g, `$1="${ANONIMO}"`)
        .replace(/\b(userId|providerId)="[^"]*"/g, '$1=""'),
  },
  {
    parte: /^xl\/revisions\//i,
    etiqueta: ETIQUETAS_OFFICE.autores,
    aplicar: (xml) =>
      xml
        .replace(/\b(userName)="[^"]*"/g, `$1="${ANONIMO}"`)
        .replace(/\b(dateTime)="[^"]*"/g, `$1="${FECHA_NEUTRA}"`),
  },
  {
    parte: /^ppt\/(commentAuthors|authors)\.xml$/i,
    etiqueta: ETIQUETAS_OFFICE.autores,
    aplicar: (xml) =>
      xml
        .replace(/\b(name)="[^"]*"/g, `$1="${ANONIMO}"`)
        .replace(/\b(initials|userId|providerId)="[^"]*"/g, '$1=""'),
  },
  {
    // Word: identificadores de sesión de edición, que relacionan documentos de un mismo equipo.
    parte: /^word\/.*\.xml$/i,
    etiqueta: ETIQUETAS_OFFICE.rsids,
    aplicar: (xml) =>
      xml
        .replace(/<w:rsids\b[^>]*>[\s\S]*?<\/w:rsids>|<w:rsids\b[^>]*\/>/g, "")
        .replace(/\s[\w.-]+:rsid\w*="[^"]*"/g, ""),
  },
  {
    // Excel: ruta absoluta del libro y nombre de quien lo compartió.
    parte: /^xl\/workbook\.xml$/i,
    etiqueta: ETIQUETAS_OFFICE.rutas,
    aplicar: (xml) =>
      xml
        .replace(
          /<mc:AlternateContent\b[^>]*>\s*<mc:Choice\b[^>]*>\s*<[\w.-]+:absPath\b[^>]*\/>\s*<\/mc:Choice>\s*<\/mc:AlternateContent>/g,
          "",
        )
        .replace(/<[\w.-]+:absPath\b[^>]*\/>/g, "")
        .replace(/<fileSharing\b[^>]*\/>/g, ""),
  },
  {
    // Word: la sección referencia el binario de la impresora; sin la parte, la referencia sobra.
    parte: /^word\/.*\.xml$/i,
    etiqueta: ETIQUETAS_OFFICE.impresora,
    aplicar: (xml) => xml.replace(/<w:printerSettings\b[^>]*\/>/g, ""),
  },
  {
    // Excel: `pageSetup` solo usa `r:id` para la impresora; el resto de sus atributos se queda.
    parte: /^xl\/(worksheets|chartsheets)\/.*\.xml$/i,
    etiqueta: ETIQUETAS_OFFICE.impresora,
    aplicar: (xml) => xml.replace(/(<pageSetup\b[^>]*?)\s+r:id="[^"]*"/g, "$1"),
  },
  {
    // Word: la tabla de fuentes deja el nombre y pierde lo incrustado; settings deja de pedirlo.
    parte: /^word\/(fontTable|settings)\.xml$/i,
    etiqueta: ETIQUETAS_OFFICE.fuentes,
    aplicar: (xml) =>
      xml
        .replace(/<w:embed(?:Regular|Bold|Italic|BoldItalic)\b[^>]*\/>/g, "")
        .replace(/<w:(?:embedTrueTypeFonts|embedSystemFonts|saveSubsetFonts)\b[^>]*\/>/g, ""),
  },
  {
    // PowerPoint: la lista de fuentes incrustadas y las banderas que la activan.
    parte: /^ppt\/presentation\.xml$/i,
    etiqueta: ETIQUETAS_OFFICE.fuentes,
    aplicar: (xml) =>
      xml
        .replace(
          /<p:embeddedFontLst\b[^>]*>[\s\S]*?<\/p:embeddedFontLst>|<p:embeddedFontLst\b[^>]*\/>/g,
          "",
        )
        .replace(/\s(?:embedTrueTypeFonts|saveSubsetFonts)="[^"]*"/g, ""),
  },
];

/** Compatibilidad: solo la regla de autores. Prefiere `limpiarXmlOffice`. */
export const anonimizarAutoresOffice = (
  parte: string,
  xml: string,
): { xml: string; cambio: boolean } => {
  const regla = REGLAS.find((r) => r.etiqueta === ETIQUETAS_OFFICE.autores && r.parte.test(parte));
  if (!regla) return { xml, cambio: false };
  const salida = regla.aplicar(xml);
  return { xml: salida, cambio: salida !== xml };
};

/** Aplica a una parte XML todas las reglas que le correspondan y dice qué cambió. */
export const limpiarXmlOffice = (
  parte: string,
  xml: string,
): { xml: string; eliminados: string[] } => {
  const eliminados = new Set<string>();
  let salida = xml;
  for (const regla of REGLAS) {
    if (!regla.parte.test(parte)) continue;
    const aplicado = regla.aplicar(salida);
    if (aplicado !== salida) eliminados.add(regla.etiqueta);
    salida = aplicado;
  }
  return { xml: salida, eliminados: [...eliminados] };
};

/** Rutas dentro del paquete en `Target` o `PartName`; un vínculo http(s) a `/fonts/` no cuenta. */
const RUTA_DEL_PAQUETE = (carpeta: string): RegExp =>
  new RegExp(`\\b(?:Target|PartName)="(?!https?:)[^"]*(?:^|/|")?\\b${carpeta}/`, "i");

const RASTROS: readonly { patron: RegExp; etiqueta: string }[] = [
  { patron: /="(?:file:|[a-z]:\\|\\\\)/i, etiqueta: ETIQUETAS_OFFICE.rutas },
  { patron: /:absPath\b/, etiqueta: ETIQUETAS_OFFICE.rutas },
  { patron: /\brsid/i, etiqueta: ETIQUETAS_OFFICE.rsids },
  { patron: /(docProps|customXml)\//i, etiqueta: ETIQUETAS_OFFICE.propiedades },
  { patron: RUTA_DEL_PAQUETE("printerSettings"), etiqueta: ETIQUETAS_OFFICE.impresora },
  { patron: /<w:printerSettings\b/, etiqueta: ETIQUETAS_OFFICE.impresora },
  { patron: RUTA_DEL_PAQUETE("fonts"), etiqueta: ETIQUETAS_OFFICE.fuentes },
  {
    patron:
      /<w:embed(?:Regular|Bold|Italic|BoldItalic|TrueTypeFonts|SystemFonts)\b|<p:embeddedFont/,
    etiqueta: ETIQUETAS_OFFICE.fuentes,
  },
];

/**
 * Comprobación posterior: lo que sobrevive en el texto de cualquier parte provoca el rechazo.
 * Nunca se afirma que algo está limpio sin haberlo verificado en la salida.
 */
export const rastrosEnXmlOffice = (xml: string): string[] => {
  const hallados = new Set<string>();
  for (const { patron, etiqueta } of RASTROS) if (patron.test(xml)) hallados.add(etiqueta);
  return [...hallados];
};

const TIPOS_IMAGEN: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const INCRUSTADOS_REPROCESABLES = new Set(["docx", "xlsx", "pptx"]);

export type ClaseParteOffice =
  | { clase: "xml" }
  | { clase: "imagen"; tipo: string }
  | { clase: "incrustado" }
  | { clase: "residual"; motivo: string }
  | { clase: "otro" };

const extension = (parte: string): string => parte.split(".").pop()?.toLowerCase() ?? "";

/** Qué hacer con cada parte. Lo que viva en media/ o embeddings/ y no se sepa limpiar, se rechaza. */
export const clasificarParteOffice = (parte: string): ClaseParteOffice => {
  const ext = extension(parte);
  if (ext === "xml" || ext === "rels") return { clase: "xml" };
  if (/\/media\//i.test(parte)) {
    const tipo = TIPOS_IMAGEN[ext];
    return tipo
      ? { clase: "imagen", tipo }
      : { clase: "residual", motivo: ETIQUETAS_OFFICE.imagenesNoLimpiables };
  }
  if (/\/embeddings\//i.test(parte)) {
    return INCRUSTADOS_REPROCESABLES.has(ext)
      ? { clase: "incrustado" }
      : { clase: "residual", motivo: ETIQUETAS_OFFICE.incrustadosNoLimpiables };
  }
  return { clase: "otro" };
};
