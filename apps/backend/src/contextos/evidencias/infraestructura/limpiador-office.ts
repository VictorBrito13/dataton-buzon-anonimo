import JSZip from "jszip";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import type { ResultadoLimpieza } from "../aplicacion/puertos.js";
import {
  anonimizarAutoresOffice,
  esParteDeMetadatosOffice,
  esParteProhibidaOffice,
  quitarReferenciasMetadatos,
} from "../dominio/office.js";
import { limpiarImagen } from "./limpiador-imagen.js";

const FECHA_NEUTRA = new Date(Date.UTC(1980, 0, 1));
const MAX_PARTES = 5_000;
const MAX_BYTES_DESCOMPRIMIDOS = 500 * 1024 * 1024;
const MAX_PROFUNDIDAD = 2;

const TIPOS_IMAGEN: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const extension = (parte: string): string => parte.split(".").pop()?.toLowerCase() ?? "";

/** JSZip no expone el tamaño declarado; se lee de su campo interno para frenar bombas ZIP. */
const tamanoDeclarado = (entrada: JSZip.JSZipObject): number =>
  (entrada as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;

const danada = (): ErrorDominio =>
  new ErrorDominio("evidencia_danada", "No pudimos leer este documento.");

const cargar = async (bytes: Uint8Array): Promise<JSZip> => {
  try {
    return await JSZip.loadAsync(bytes);
  } catch {
    throw danada();
  }
};

const procesar = async (bytes: Uint8Array, profundidad: number): Promise<ResultadoLimpieza> => {
  const zip = await cargar(bytes);
  const entradas = Object.values(zip.files);
  const declarado = entradas.reduce((suma, e) => suma + tamanoDeclarado(e), 0);
  if (entradas.length > MAX_PARTES || declarado > MAX_BYTES_DESCOMPRIMIDOS) throw danada();
  if (entradas.some((e) => esParteProhibidaOffice(e.name))) {
    throw new ErrorDominio(
      "contenido_activo",
      "Este documento contiene macros o programas incrustados y no se admite.",
    );
  }

  const eliminados = new Set<string>();
  const residuales = new Set<string>();

  for (const entrada of entradas) {
    if (entrada.dir || !esParteDeMetadatosOffice(entrada.name)) continue;
    eliminados.add(
      entrada.name.includes("thumbnail")
        ? "Miniatura del documento"
        : entrada.name.startsWith("customXml")
          ? "Datos XML personalizados"
          : "Propiedades del documento (autor, empresa, fechas)",
    );
  }
  for (const entrada of entradas) {
    if (esParteDeMetadatosOffice(entrada.name)) zip.remove(entrada.name);
  }

  for (const entrada of Object.values(zip.files)) {
    if (entrada.dir) continue;
    const { name } = entrada;
    const ext = extension(name);
    if (name === "[Content_Types].xml" || ext === "rels") {
      const xml = await entrada.async("string");
      const limpio = quitarReferenciasMetadatos(xml);
      if (limpio !== xml) zip.file(name, limpio);
    } else if (ext === "xml") {
      const { xml, cambio } = anonimizarAutoresOffice(name, await entrada.async("string"));
      if (cambio) {
        zip.file(name, xml);
        eliminados.add("Autores y fechas de comentarios y control de cambios");
      }
    } else if (/\/media\//i.test(name) && TIPOS_IMAGEN[ext]) {
      const limpia = await limpiarImagen(TIPOS_IMAGEN[ext], await entrada.async("uint8array"));
      zip.file(name, limpia.bytes);
      limpia.residuales.forEach((r) => residuales.add(r));
      if (limpia.eliminados.length > 0) eliminados.add("Metadatos de imágenes incrustadas");
    } else if (/\/embeddings\//i.test(name) && ["docx", "xlsx", "pptx"].includes(ext)) {
      if (profundidad >= MAX_PROFUNDIDAD) {
        residuales.add("Documentos incrustados en demasiados niveles");
        continue;
      }
      const interno = await procesar(await entrada.async("uint8array"), profundidad + 1);
      zip.file(name, interno.bytes);
      interno.residuales.forEach((r) => residuales.add(r));
      if (interno.eliminados.length > 0) eliminados.add("Metadatos de documentos incrustados");
    }
  }

  // Las fechas y comentarios del propio ZIP también pueden revelar cuándo y quién editó.
  for (const entrada of Object.values(zip.files)) {
    entrada.date = FECHA_NEUTRA;
    entrada.comment = "";
  }
  const salida = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    platform: "DOS",
    comment: "",
  });

  if (Object.keys(zip.files).some(esParteDeMetadatosOffice)) residuales.add("Propiedades");
  return { bytes: salida, eliminados: [...eliminados], residuales: [...residuales] };
};

export const limpiarOffice = async (bytes: Uint8Array): Promise<ResultadoLimpieza> => {
  try {
    return await procesar(bytes, 0);
  } catch (error) {
    if (error instanceof ErrorDominio) throw error;
    throw danada();
  }
};
