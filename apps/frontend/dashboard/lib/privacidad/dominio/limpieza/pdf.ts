import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  type PDFObject,
} from "pdf-lib";
import { ErrorLimpieza, type BytesLimpios } from "./errores";
import { limpiarJpeg } from "./imagen";

/**
 * Reescribe el PDF desde cero conservando solo lo que se alcanza desde el
 * catálogo. Así desaparecen las revisiones incrementales, que dejan versiones
 * viejas de los datos dentro del archivo aunque ya no se usen.
 */

const CAMPOS_INFO: Record<string, string> = {
  Author: "Autor",
  Title: "Título",
  Subject: "Asunto",
  Keywords: "Palabras clave",
  Creator: "Programa que lo creó",
  Producer: "Programa que lo generó",
  CreationDate: "Fecha de creación",
  ModDate: "Fecha de modificación",
};

const n = (nombre: string) => PDFName.of(nombre);

const NO_SE_PUDO = "No se pudo leer este PDF para limpiarlo. Parece dañado.";
const PROTEGIDO =
  "Este PDF está protegido con contraseña y no podemos limpiarlo. Quita la contraseña y vuelve a intentarlo.";

const textoDe = (valor: PDFObject | undefined): string | null => {
  if (valor instanceof PDFString || valor instanceof PDFHexString) return valor.decodeText();
  return null;
};

/** Un campo vacío no es un dato que se haya quitado. */
const tieneValor = (valor: PDFObject | undefined) => {
  if (valor === undefined) return false;
  const texto = textoDe(valor);
  return texto === null || texto.trim() !== "";
};

const contarOcurrencias = (bytes: Uint8Array, palabra: string) => {
  const texto = new TextDecoder("latin1").decode(bytes);
  return texto.split(palabra).length - 1;
};

const tieneRevisiones = (bytes: Uint8Array) => {
  // Un PDF linealizado trae dos tablas por diseño: no son revisiones.
  const linealizado = new TextDecoder("latin1")
    .decode(bytes.subarray(0, 2048))
    .includes("/Linearized");
  return contarOcurrencias(bytes, "startxref") > (linealizado ? 2 : 1);
};

const leerInfo = (doc: PDFDocument, eliminados: Set<string>) => {
  const info = doc.context.lookupMaybe(doc.context.trailerInfo.Info, PDFDict);
  if (!info) return;
  for (const [clave, valor] of info.entries()) {
    const nombre = clave.decodeText();
    if (!tieneValor(doc.context.lookup(valor))) continue;
    eliminados.add(CAMPOS_INFO[nombre] ?? "Propiedades personalizadas");
  }
};

const limpiarCatalogo = (doc: PDFDocument, eliminados: Set<string>) => {
  const catalogo = doc.catalog;
  const nombres = catalogo.lookupMaybe(n("Names"), PDFDict);
  if (nombres?.has(n("EmbeddedFiles"))) {
    nombres.delete(n("EmbeddedFiles"));
    eliminados.add("Archivos adjuntos");
  }
  if (catalogo.delete(n("AF"))) eliminados.add("Archivos adjuntos");
  if (catalogo.delete(n("Perms"))) eliminados.add("Firma digital");
  if (catalogo.delete(n("DSS"))) eliminados.add("Firma digital");
};

const limpiarDiccionario = (dict: PDFDict, eliminados: Set<string>) => {
  if (dict.delete(n("Metadata"))) eliminados.add("Datos XMP");
  if (dict.delete(n("PieceInfo"))) eliminados.add("Datos privados de la aplicación");
  if (dict.delete(n("LastModified"))) eliminados.add("Fecha de modificación");
  if (dict.delete(n("Thumb"))) eliminados.add("Miniatura");

  // Especificación de archivo con contenido incrustado.
  if (dict.has(n("EF"))) {
    dict.delete(n("EF"));
    dict.delete(n("F"));
    dict.delete(n("UF"));
    eliminados.add("Archivos adjuntos");
  }
  // Una firma digital contiene el certificado de quien firmó.
  if (dict.get(n("FT")) === n("Sig") && dict.delete(n("V"))) eliminados.add("Firma digital");

  // Anotaciones. En los campos de formulario (Widget), T es el nombre del campo.
  const subtipo = dict.get(n("Subtype"));
  if (subtipo instanceof PDFName && subtipo !== n("Widget") && dict.has(n("Rect"))) {
    if (tieneValor(dict.lookup(n("T")))) eliminados.add("Autor de comentarios");
    dict.delete(n("T"));
    if (dict.delete(n("M")) || dict.delete(n("CreationDate"))) {
      eliminados.add("Fechas de comentarios");
    }
    dict.delete(n("CreationDate"));
  }
};

/** Recorre todo lo alcanzable desde la raíz y devuelve las referencias visitadas. */
const recorrer = (doc: PDFDocument, raiz: PDFRef, eliminados: Set<string>) => {
  const vistos = new Set<string>();
  const pendientes: PDFObject[] = [raiz];
  while (pendientes.length > 0) {
    const objeto = pendientes.pop();
    if (objeto instanceof PDFRef) {
      if (vistos.has(objeto.tag)) continue;
      vistos.add(objeto.tag);
      const destino = doc.context.lookup(objeto);
      if (destino) pendientes.push(destino);
    } else if (objeto instanceof PDFArray) {
      pendientes.push(...objeto.asArray());
    } else if (objeto instanceof PDFStream || objeto instanceof PDFDict) {
      const dict = objeto instanceof PDFStream ? objeto.dict : objeto;
      limpiarDiccionario(dict, eliminados);
      pendientes.push(...dict.values());
    }
  }
  return vistos;
};

const esJpegIncrustado = (stream: PDFRawStream) => {
  const filtro = stream.dict.get(n("Filter"));
  if (filtro === n("DCTDecode")) return true;
  return filtro instanceof PDFArray && filtro.size() === 1 && filtro.get(0) === n("DCTDecode");
};

const limpiarFotos = (doc: PDFDocument, eliminados: Set<string>) => {
  for (const [ref, objeto] of doc.context.enumerateIndirectObjects()) {
    if (!(objeto instanceof PDFRawStream) || !esJpegIncrustado(objeto)) continue;
    try {
      const limpio = limpiarJpeg(objeto.getContents());
      if (limpio.eliminados.length > 0) {
        doc.context.assign(ref, PDFRawStream.of(objeto.dict, limpio.bytes));
        eliminados.add("Metadatos de fotos incrustadas");
      }
    } catch (error) {
      // Una foto que no se entiende no puede prometerse limpia: mejor rechazar el PDF.
      if (error instanceof ErrorLimpieza) {
        throw new ErrorLimpieza(
          "Este PDF contiene una imagen que no podemos limpiar. Expórtalo de nuevo a PDF y vuelve a intentarlo.",
        );
      }
      throw error;
    }
  }
};

const cargar = async (bytes: Uint8Array) => {
  let doc: PDFDocument;
  try {
    // Se pregunta por isEncrypted porque el error de pdf-lib no sobrevive a instanceof.
    doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  } catch {
    throw new ErrorLimpieza(NO_SE_PUDO);
  }
  if (doc.isEncrypted) throw new ErrorLimpieza(PROTEGIDO);
  return doc;
};

export const limpiarPdf = async (bytes: Uint8Array): Promise<BytesLimpios> => {
  const encabezado = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  if (!encabezado.includes("%PDF-")) throw new ErrorLimpieza(NO_SE_PUDO);

  const doc = await cargar(bytes);
  const eliminados = new Set<string>();

  leerInfo(doc, eliminados);
  if (tieneRevisiones(bytes)) eliminados.add("Revisiones anteriores del documento");
  limpiarCatalogo(doc, eliminados);

  const raiz = doc.context.trailerInfo.Root;
  if (!(raiz instanceof PDFRef)) throw new ErrorLimpieza(NO_SE_PUDO);
  const alcanzables = recorrer(doc, raiz, eliminados);

  doc.context.trailerInfo.Info = undefined;
  doc.context.trailerInfo.ID = undefined;
  for (const [ref] of doc.context.enumerateIndirectObjects()) {
    if (!alcanzables.has(ref.tag)) doc.context.delete(ref);
  }
  limpiarFotos(doc, eliminados);

  const salida = await doc.save({
    useObjectStreams: false,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });

  // Comprobación final: un PDF que no se vuelve a abrir o conserva datos no se entrega.
  const revision = await cargar(salida);
  if (revision.context.trailerInfo.Info || revision.catalog.has(n("Metadata"))) {
    throw new ErrorLimpieza(NO_SE_PUDO);
  }
  return { bytes: salida, eliminados: [...eliminados] };
};
