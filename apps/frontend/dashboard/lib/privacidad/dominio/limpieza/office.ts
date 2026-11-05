import JSZip from "jszip";
import { ErrorLimpieza, type BytesLimpios } from "./errores";
import { detectarFormato } from "./formato";
import { limpiarImagen, type FormatoImagen } from "./imagen";

/**
 * Limpia DOCX, XLSX y PPTX. Las partes que solo guardan metadatos se quitan del
 * paquete; donde el formato exige un valor, se reemplaza por uno genérico para
 * que el documento siga abriendo.
 */

const NO_ES_OFFICE = "No es un documento de Word, Excel o PowerPoint que podamos limpiar.";
const CON_MACROS =
  "Este documento contiene macros y no podemos limpiarlo con seguridad. Guárdalo como .docx, .xlsx o .pptx sin macros.";

const TIPOS_ADMITIDOS =
  /wordprocessingml\.document\.main|spreadsheetml\.sheet\.main|presentationml\.presentation\.main/;

const AUTOR_GENERICO = "Autor";
const ETIQUETA_AUTORES = "Autores de comentarios o cambios";
const ETIQUETA_RUTAS = "Rutas de archivos en tu equipo";
const ETIQUETA_FECHAS = "Fechas de comentarios o cambios";
const ETIQUETA_IMPRESORA = "Configuración de impresora";
const ETIQUETA_FUENTES = "Fuentes incrustadas";

/** Las fechas de un ZIP delatan cuándo se editó. 1980 es la mínima del formato. */
const FECHA_FIJA = new Date(Date.UTC(1980, 0, 1));

const CAMPOS_CORE: Record<string, string> = {
  title: "Título",
  subject: "Asunto",
  creator: "Autor",
  keywords: "Palabras clave",
  description: "Descripción",
  lastModifiedBy: "Última persona que lo modificó",
  revision: "Número de revisión",
  created: "Fecha de creación",
  modified: "Fecha de modificación",
  lastPrinted: "Fecha de última impresión",
  category: "Categoría",
  contentStatus: "Estado del documento",
};

const CAMPOS_APP: Record<string, string> = {
  Application: "Programa utilizado",
  AppVersion: "Programa utilizado",
  Company: "Empresa",
  Manager: "Responsable (Manager)",
  TotalTime: "Tiempo de edición",
  Template: "Plantilla utilizada",
  HyperlinkBase: "Rutas de archivos en tu equipo",
};

/**
 * `printerSettings/` son binarios con el nombre de la impresora (y a veces de la red); `fonts/`
 * son fuentes incrustadas, cuyas tablas pueden nombrar al licenciatario. El documento abre sin
 * ellas: Word y PowerPoint sustituyen la fuente y Excel imprime con la impresora predeterminada.
 */
const PARTES_A_QUITAR = [
  /^docProps\/(core|app|custom)\.xml$/,
  /^docProps\/thumbnail\.[^/]+$/,
  /^word\/people\.xml$/,
  /^customXml\//,
  /^xl\/revisions\//,
  /(^|\/)printerSettings\//i,
  /(^|\/)fonts\//i,
];

const leerCampos = (xml: string, campos: Record<string, string>, eliminados: Set<string>) => {
  for (const [campo, etiqueta] of Object.entries(campos)) {
    const valor = new RegExp(`<(?:[\\w.-]+:)?${campo}\\b[^>]*>([^<]*)<`).exec(xml)?.[1]?.trim();
    if (valor && !(campo === "TotalTime" && valor === "0")) eliminados.add(etiqueta);
  }
};

/** Reemplaza con una regex y avisa si hubo un cambio real. */
const sustituir = (
  xml: string,
  regex: RegExp,
  reemplazo: string | ((coincidencia: string, ...grupos: string[]) => string),
  alCambiar: () => void,
) => {
  const resultado = xml.replace(regex, reemplazo as (s: string, ...g: string[]) => string);
  if (resultado !== xml) alCambiar();
  return resultado;
};

/** Destino inofensivo para vínculos y plantillas con rutas del equipo. */
const DESTINO_NEUTRO = "about:blank";
/** `file:`, `C:\…`, `\\servidor\…` y cualquier esquema que no sea http(s). */
const RUTA_LOCAL = /^(?:file:|[a-z]:[\\/]|\\\\|\/\/)/i;
const ESQUEMA_PERMITIDO = /^https?:\/\//i;

const destinoRevelador = (relacion: string) => {
  const destino = /\bTarget="([^"]*)"/.exec(relacion)?.[1];
  if (destino === undefined || destino === DESTINO_NEUTRO) return false;
  if (RUTA_LOCAL.test(destino)) return true;
  return /\bTargetMode="External"/i.test(relacion) && !ESQUEMA_PERMITIDO.test(destino);
};

/**
 * Comprobación posterior sobre cada XML de salida: si algo sobrevive, se rechaza el archivo.
 * Nunca se afirma que está limpio lo que no se comprobó.
 */
/** Rutas dentro del paquete en `Target` o `PartName`; un vínculo http(s) a `/fonts/` no cuenta. */
const rutaDelPaquete = (carpeta: string) =>
  new RegExp(`\\b(?:Target|PartName)="(?!https?:)[^"]*\\b${carpeta}/`, "i");
const RASTROS = [
  /="(?:file:|[a-z]:\\|\\\\)/i,
  /:absPath\b/,
  /\brsid/i,
  /(docProps|customXml)\//i,
  rutaDelPaquete("printerSettings"),
  rutaDelPaquete("fonts"),
  /<w:printerSettings\b/,
  /<w:embed(?:Regular|Bold|Italic|BoldItalic|TrueTypeFonts|SystemFonts)\b|<p:embeddedFont/,
];
const sobrevivenRastros = (xml: string) => RASTROS.some((patron) => patron.test(xml));

const IMAGEN_NO_LIMPIABLE =
  "Este documento contiene una imagen en un formato que no podemos limpiar (como TIFF, GIF, BMP o EMF) y podría llevar tu ubicación. Conviértela a JPEG o PNG y vuelve a intentarlo.";
const INCRUSTADO_NO_LIMPIABLE =
  "Este documento contiene un objeto incrustado (PDF, documento con macros u otro archivo) que no podemos limpiar. Quítalo y vuelve a intentarlo.";
const RASTRO_SOBREVIVIENTE =
  "No pudimos quitar todas las rutas o identificadores de este documento. Guárdalo de nuevo desde tu programa de oficina o conviértelo a PDF.";

const INCRUSTADOS_REPROCESABLES = /\.(docx|xlsx|pptx)$/i;
const MAX_PROFUNDIDAD = 2;

const rutaDeDestino = (rutaRels: string, destino: string) => {
  if (destino.startsWith("/")) return destino.slice(1);
  const base = rutaRels.replace(/_rels\/[^/]*$/, "");
  const piezas: string[] = [];
  for (const pieza of `${base}${destino}`.split("/")) {
    if (pieza === "..") piezas.pop();
    else if (pieza !== "." && pieza !== "") piezas.push(pieza);
  }
  return piezas.join("/");
};

const quitarReferencias = (partes: Map<string, string | Uint8Array>, quitadas: Set<string>) => {
  for (const [ruta, contenido] of partes) {
    if (typeof contenido !== "string") continue;
    if (ruta.endsWith(".rels")) {
      partes.set(
        ruta,
        contenido.replace(/<Relationship\b[^>]*\/>/g, (relacion) => {
          const destino = /\bTarget="([^"]*)"/.exec(relacion)?.[1];
          return destino !== undefined && quitadas.has(rutaDeDestino(ruta, destino))
            ? ""
            : relacion;
        }),
      );
    } else if (ruta === "[Content_Types].xml") {
      partes.set(
        ruta,
        contenido.replace(/<Override\b[^>]*\/>/g, (override) => {
          const parte = /\bPartName="\/?([^"]*)"/.exec(override)?.[1];
          return parte !== undefined && quitadas.has(parte) ? "" : override;
        }),
      );
    }
  }
};

const limpiarXml = (ruta: string, original: string, eliminados: Set<string>) => {
  let xml = original;
  const autores = () => eliminados.add(ETIQUETA_AUTORES);
  const rutas = () => eliminados.add(ETIQUETA_RUTAS);
  const fechas = () => eliminados.add(ETIQUETA_FECHAS);
  const esComentarios = /comments?/i.test(ruta);

  if (ruta.endsWith(".rels")) {
    // Se vacía el destino y se conserva la relación: otras partes referencian su Id.
    return sustituir(
      xml,
      /<Relationship\b[^>]*\/>/g,
      (relacion) =>
        destinoRevelador(relacion)
          ? relacion.replace(/\bTarget="[^"]*"/, `Target="${DESTINO_NEUTRO}"`)
          : relacion,
      rutas,
    );
  }

  // El autor es obligatorio en comentarios y cambios: se deja un valor genérico.
  xml = sustituir(xml, /(\s(?:[\w.-]+:)?author=")[^"]*(")/gi, `$1${AUTOR_GENERICO}$2`, autores);
  xml = sustituir(xml, /\sw:initials="[^"]*"/g, "", autores);
  xml = sustituir(xml, /(\sinitials=")[^"]*(")/g, "$1A$2", autores);
  xml = sustituir(xml, /\s(?:[\w.-]+:)?date(?:Utc)?="[^"]*"/g, "", fechas);
  if (esComentarios) xml = sustituir(xml, /\s(?:dt|created)="[^"]*"/gi, "", fechas);

  // Identificadores de sesión de edición: permiten relacionar documentos de un mismo equipo.
  xml = sustituir(xml, /\s(?:[\w.-]+:)?rsid\w*="[^"]*"/g, "", () =>
    eliminados.add("Identificadores de edición"),
  );
  xml = sustituir(xml, /<w:rsids\b[^>]*>[\s\S]*?<\/w:rsids>|<w:rsids\b[^>]*\/>/g, "", () =>
    eliminados.add("Identificadores de edición"),
  );

  if (/^xl\/comments/.test(ruta)) {
    // Excel repite el nombre al inicio del texto de cada comentario.
    const nombres = [...xml.matchAll(/<author>([^<]+)<\/author>/g)]
      .map((m) => m[1])
      .filter((nombre) => nombre !== AUTOR_GENERICO && nombre.length > 1);
    for (const nombre of nombres) xml = xml.split(nombre).join(AUTOR_GENERICO);
    if (nombres.length > 0) autores();
  }
  if (/^xl\/persons\//.test(ruta)) {
    xml = sustituir(xml, /(\sdisplayName=")(?!Autor")[^"]*(")/g, `$1${AUTOR_GENERICO}$2`, autores);
    xml = sustituir(xml, /(\suserId=")[^"]+(")/g, "$1$2", autores);
    xml = sustituir(xml, /(\sproviderId=")(?!None")[^"]*(")/g, "$1None$2", autores);
  }
  if (/^ppt\/(?:commentAuthors|authors)\.xml$/.test(ruta)) {
    xml = sustituir(xml, /(\sname=")(?!Autor")[^"]*(")/g, `$1${AUTOR_GENERICO}$2`, autores);
    xml = sustituir(xml, /(\suserId=")[^"]+(")/g, "$1$2", autores);
    xml = sustituir(xml, /(\sproviderId=")(?!None")[^"]*(")/g, "$1None$2", autores);
  }
  if (ruta === "xl/workbook.xml") {
    xml = sustituir(xml, /<fileSharing\b[^>]*\/>/g, "", autores);
    xml = sustituir(
      xml,
      /<mc:AlternateContent\b[^>]*>\s*<mc:Choice\b[^>]*>\s*<[\w.-]+:absPath\b[^>]*\/>\s*<\/mc:Choice>\s*<\/mc:AlternateContent>/g,
      "",
      rutas,
    );
    xml = sustituir(xml, /<[\w.-]+:absPath\b[^>]*\/>/g, "", rutas);
  }

  // Referencias a las partes de impresora y fuentes que ya no están: sin ellas Office no reclama.
  const impresora = () => eliminados.add(ETIQUETA_IMPRESORA);
  const fuentes = () => eliminados.add(ETIQUETA_FUENTES);
  if (/^word\//.test(ruta)) {
    xml = sustituir(xml, /<w:printerSettings\b[^>]*\/>/g, "", impresora);
  }
  if (/^word\/(?:fontTable|settings)\.xml$/.test(ruta)) {
    xml = sustituir(xml, /<w:embed(?:Regular|Bold|Italic|BoldItalic)\b[^>]*\/>/g, "", fuentes);
    xml = sustituir(
      xml,
      /<w:(?:embedTrueTypeFonts|embedSystemFonts|saveSubsetFonts)\b[^>]*\/>/g,
      "",
      fuentes,
    );
  }
  if (/^xl\/(?:worksheets|chartsheets)\//.test(ruta)) {
    // `pageSetup` solo usa `r:id` para la impresora; sus demás atributos se conservan.
    xml = sustituir(xml, /(<pageSetup\b[^>]*?)\s+r:id="[^"]*"/g, "$1", impresora);
  }
  if (ruta === "ppt/presentation.xml") {
    xml = sustituir(
      xml,
      /<p:embeddedFontLst\b[^>]*>[\s\S]*?<\/p:embeddedFontLst>|<p:embeddedFontLst\b[^>]*\/>/g,
      "",
      fuentes,
    );
    xml = sustituir(xml, /\s(?:embedTrueTypeFonts|saveSubsetFonts)="[^"]*"/g, "", fuentes);
  }
  return xml;
};

const leerPaquete = async (bytes: Uint8Array) => {
  try {
    return await JSZip.loadAsync(bytes);
  } catch {
    throw new ErrorLimpieza(NO_ES_OFFICE);
  }
};

const esXml = (ruta: string) => /\.(xml|rels|vml)$/i.test(ruta);

export type TipoOffice = "docx" | "xlsx" | "pptx";

const tipoDeOffice = (tipos: string): TipoOffice => {
  if (tipos.includes("wordprocessingml.document.main")) return "docx";
  return tipos.includes("spreadsheetml.sheet.main") ? "xlsx" : "pptx";
};

export const limpiarOffice = (bytes: Uint8Array): Promise<BytesLimpios & { tipo: TipoOffice }> =>
  limpiarPaquete(bytes, 0);

const limpiarPaquete = async (
  bytes: Uint8Array,
  profundidad: number,
): Promise<BytesLimpios & { tipo: TipoOffice }> => {
  const zip = await leerPaquete(bytes);
  const entradaTipos = zip.file("[Content_Types].xml");
  if (!entradaTipos) throw new ErrorLimpieza(NO_ES_OFFICE);
  const tipos = await entradaTipos.async("string");
  if (/macroEnabled/i.test(tipos)) throw new ErrorLimpieza(CON_MACROS);
  if (!TIPOS_ADMITIDOS.test(tipos)) throw new ErrorLimpieza(NO_ES_OFFICE);

  const eliminados = new Set<string>();
  // JSZip lo expone al leer, aunque sus tipos no lo declaren.
  if ((zip as JSZip & { comment?: string | null }).comment) eliminados.add("Comentario");

  const partes = new Map<string, string | Uint8Array>();
  for (const [ruta, entrada] of Object.entries(zip.files)) {
    if (entrada.dir) continue;
    const crudo = await entrada.async("uint8array");
    if (!esXml(ruta)) {
      partes.set(ruta, crudo);
      continue;
    }
    // El texto solo se puede revisar en UTF-8. Mejor rechazar que dejar datos sin revisar.
    if ((crudo[0] === 0xff && crudo[1] === 0xfe) || (crudo[0] === 0xfe && crudo[1] === 0xff)) {
      throw new ErrorLimpieza(NO_ES_OFFICE);
    }
    partes.set(ruta, new TextDecoder().decode(crudo));
  }

  const core = partes.get("docProps/core.xml");
  if (typeof core === "string") leerCampos(core, CAMPOS_CORE, eliminados);
  const app = partes.get("docProps/app.xml");
  if (typeof app === "string") leerCampos(app, CAMPOS_APP, eliminados);
  const custom = partes.get("docProps/custom.xml");
  if (typeof custom === "string" && /<(?:[\w.-]+:)?property\b/.test(custom)) {
    eliminados.add("Propiedades personalizadas");
  }

  const quitadas = new Set<string>();
  for (const ruta of partes.keys()) {
    if (!PARTES_A_QUITAR.some((patron) => patron.test(ruta))) continue;
    quitadas.add(ruta);
    if (ruta.startsWith("docProps/thumbnail")) eliminados.add("Miniatura");
    if (ruta.startsWith("customXml/")) eliminados.add("Datos personalizados");
    if (ruta === "word/people.xml") eliminados.add(ETIQUETA_AUTORES);
    if (ruta.startsWith("xl/revisions/")) eliminados.add("Revisiones anteriores del documento");
    if (/(^|\/)printerSettings\//i.test(ruta)) eliminados.add(ETIQUETA_IMPRESORA);
    if (/(^|\/)fonts\//i.test(ruta)) eliminados.add(ETIQUETA_FUENTES);
  }
  for (const ruta of quitadas) partes.delete(ruta);
  quitarReferencias(partes, quitadas);

  const salida = new JSZip();
  for (const [ruta, contenido] of partes) {
    let limpio = contenido;
    if (typeof contenido === "string") {
      limpio = limpiarXml(ruta, contenido, eliminados);
      if (sobrevivenRastros(limpio)) throw new ErrorLimpieza(RASTRO_SOBREVIVIENTE);
    } else if (/\/media\//i.test(ruta)) {
      // Nombre y contenido deben coincidir con un formato que sí se limpia; si no, se rechaza.
      const formato = detectarFormato(contenido);
      if (
        !/\.(jpe?g|png|webp)$/i.test(ruta) ||
        (formato !== "jpeg" && formato !== "png" && formato !== "webp")
      ) {
        throw new ErrorLimpieza(IMAGEN_NO_LIMPIABLE);
      }
      try {
        const imagen = limpiarImagen(contenido, formato as FormatoImagen);
        if (imagen.eliminados.length > 0) eliminados.add("Metadatos de fotos incrustadas");
        limpio = imagen.bytes;
      } catch (error) {
        if (error instanceof ErrorLimpieza) {
          throw new ErrorLimpieza(
            "Este documento contiene una imagen dañada que no podemos limpiar. Quítala y vuelve a intentarlo.",
          );
        }
        throw error;
      }
    } else if (/\/embeddings\//i.test(ruta)) {
      if (!INCRUSTADOS_REPROCESABLES.test(ruta) || profundidad >= MAX_PROFUNDIDAD) {
        throw new ErrorLimpieza(INCRUSTADO_NO_LIMPIABLE);
      }
      const interno = await limpiarPaquete(contenido, profundidad + 1);
      if (interno.eliminados.length > 0) eliminados.add("Metadatos de documentos incrustados");
      limpio = interno.bytes;
    }
    salida.file(ruta, limpio, { date: FECHA_FIJA, createFolders: false });
  }

  return {
    bytes: await salida.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
    eliminados: [...eliminados],
    tipo: tipoDeOffice(tipos),
  };
};
