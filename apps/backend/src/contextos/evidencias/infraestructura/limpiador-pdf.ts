import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFStream,
  type PDFObject,
} from "pdf-lib";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import type { ResultadoLimpieza } from "../aplicacion/puertos.js";
import { quitarMetadatosJpeg } from "../dominio/jpeg.js";
import { exigirComplejidadPdf } from "../dominio/politica.js";

const nombre = (texto: string): PDFName => PDFName.of(texto);

/** Claves que pueden colgar de una página, formulario o fuente y llevar metadatos o código. */
const CLAVES_A_QUITAR = ["Metadata", "PieceInfo", "AA", "Thumb", "LastModified"].map(nombre);
const ANOTACIONES = nombre("Annots");

const MARCAS_RESIDUALES = [
  "/Metadata",
  "/EmbeddedFile",
  "/JavaScript",
  "/Author",
  "/Producer",
  "/Creator",
];

/** Con `useObjectStreams: false` los diccionarios quedan legibles y se puede inspeccionar el resultado. */
const limpiarDiccionario = (objeto: PDFObject | undefined): void => {
  if (objeto instanceof PDFStream) {
    limpiarDiccionario(objeto.dict);
  } else if (objeto instanceof PDFDict) {
    for (const clave of CLAVES_A_QUITAR) objeto.delete(clave);
    for (const [, valor] of objeto.entries()) limpiarDiccionario(valor);
  } else if (objeto instanceof PDFArray) {
    for (const valor of objeto.asArray()) limpiarDiccionario(valor);
  }
};

const esJpeg = (flujo: PDFRawStream): boolean => {
  const filtro = flujo.dict.lookup(nombre("Filter"));
  const unico = filtro instanceof PDFArray && filtro.size() === 1 ? filtro.get(0) : filtro;
  return unico === nombre("DCTDecode");
};

const describirOrigen = (origen: PDFDocument, bytes: Uint8Array): string[] => {
  const hallazgos: string[] = [];
  const { context, catalog } = origen;
  const info = context.lookup(context.trailerInfo.Info);
  if (info instanceof PDFDict && info.entries().length > 0) {
    hallazgos.push("Información del documento (autor, título, fechas, programa)");
  }
  if (catalog.has(nombre("Metadata"))) hallazgos.push("Metadatos XMP");
  const nombres = catalog.lookup(nombre("Names"));
  if (nombres instanceof PDFDict && nombres.has(nombre("EmbeddedFiles"))) {
    hallazgos.push("Archivos adjuntos");
  }
  if (
    (nombres instanceof PDFDict && nombres.has(nombre("JavaScript"))) ||
    catalog.has(nombre("OpenAction"))
  ) {
    hallazgos.push("Código y acciones automáticas");
  }
  if (origen.getPages().some((p) => p.node.has(ANOTACIONES))) {
    hallazgos.push("Comentarios, anotaciones y enlaces");
  }
  if (catalog.has(nombre("Outlines"))) hallazgos.push("Marcadores");
  const finales = Buffer.from(bytes).toString("latin1").split("%%EOF").length - 1;
  if (finales > 1) hallazgos.push("Revisiones anteriores del archivo");
  return hallazgos;
};

/**
 * Reescribe el PDF copiando solo las páginas a un documento nuevo. Lo que no cuelga de una página
 * (Info, XMP, adjuntos, scripts, revisiones incrementales, objetos huérfanos) no se copia.
 * Límites conocidos en el README: no toca el contenido visible, capas ocultas ni texto oculto.
 */
export const limpiarPdf = async (bytes: Uint8Array): Promise<ResultadoLimpieza> => {
  let origen: PDFDocument;
  let cifrado = false;
  try {
    // pdf-lib está transpilado a ES5: `instanceof EncryptedPDFError` no funciona, por eso se
    // carga ignorando el cifrado y se consulta la marca explícita.
    origen = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    cifrado = origen.isEncrypted;
    if (!cifrado && origen.getPageCount() === 0) throw new Error("Sin páginas");
  } catch {
    throw new ErrorDominio("evidencia_danada", "No pudimos leer este PDF.");
  }
  if (cifrado) {
    throw new ErrorDominio(
      "evidencia_cifrada",
      "Este PDF está protegido con contraseña; quítala para poder enviarlo.",
    );
  }
  // Antes de aplanar y copiar páginas, que es donde se gasta la CPU y la memoria.
  exigirComplejidadPdf({
    paginas: origen.getPageCount(),
    objetos: origen.context.enumerateIndirectObjects().length,
  });

  try {
    const eliminados = describirOrigen(origen, bytes);
    try {
      // Fija lo escrito en formularios como contenido de la página antes de quitar anotaciones.
      origen.getForm().flatten();
    } catch {
      eliminados.push("Campos de formulario que no se pudieron conservar");
    }
    for (const pagina of origen.getPages()) pagina.node.delete(ANOTACIONES);

    const destino = await PDFDocument.create({ updateMetadata: false });
    const paginas = await destino.copyPages(origen, origen.getPageIndices());
    for (const pagina of paginas) destino.addPage(pagina);

    let exifEnImagenes = false;
    for (const [referencia, objeto] of destino.context.enumerateIndirectObjects()) {
      limpiarDiccionario(objeto);
      if (objeto instanceof PDFRawStream && esJpeg(objeto)) {
        const limpio = quitarMetadatosJpeg(objeto.getContents());
        if (limpio.cambio) {
          exifEnImagenes = true;
          destino.context.assign(referencia, PDFRawStream.of(objeto.dict, limpio.bytes));
        }
      }
    }
    if (exifEnImagenes) eliminados.push("EXIF de imágenes dentro del PDF");

    const salida = await destino.save({ useObjectStreams: false, updateFieldAppearances: false });
    const texto = Buffer.from(salida).toString("latin1");
    return {
      bytes: salida,
      eliminados,
      residuales: MARCAS_RESIDUALES.filter((marca) => texto.includes(marca)),
    };
  } catch {
    throw new ErrorDominio("evidencia_danada", "No pudimos procesar este PDF.");
  }
};
