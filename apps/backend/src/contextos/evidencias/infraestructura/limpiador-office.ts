import JSZip from "jszip";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import type { ResultadoLimpieza } from "../aplicacion/puertos.js";
import {
  clasificarParteOffice,
  esParteDeMetadatosOffice,
  esParteProhibidaOffice,
  ETIQUETAS_OFFICE,
  limpiarXmlOffice,
  neutralizarRelacionesExternas,
  quitarReferenciasMetadatos,
  rastrosEnXmlOffice,
} from "../dominio/office.js";
import { limpiarImagen } from "./limpiador-imagen.js";

const FECHA_NEUTRA = new Date(Date.UTC(1980, 0, 1));
const MAX_PARTES = 5_000;
const MAX_BYTES_DESCOMPRIMIDOS = 50 * 1024 * 1024;
const MAX_PROFUNDIDAD = 2;

/** JSZip no expone el tamaño declarado; se lee de su campo interno como primer filtro barato. */
const tamanoDeclarado = (entrada: JSZip.JSZipObject): number =>
  (entrada as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;

interface FlujoInterno {
  on(evento: "data", oyente: (trozo: Uint8Array) => void): FlujoInterno;
  on(evento: "end", oyente: () => void): FlujoInterno;
  on(evento: "error", oyente: (error: Error) => void): FlujoInterno;
  resume(): FlujoInterno;
  pause(): FlujoInterno;
}

/**
 * Las cabeceras de un ZIP pueden mentir. Se infla cada parte en flujo, sin retenerla, y se
 * corta en cuanto el total real supera el máximo: así una bomba no llega a ocupar memoria.
 */
const medirInflado = (entradas: JSZip.JSZipObject[], maximo: number): Promise<number> =>
  entradas.reduce(
    (acumulado, entrada) =>
      acumulado.then(
        (total) =>
          new Promise<number>((resolver, rechazar) => {
            let parcial = total;
            const flujo = (
              entrada as unknown as { internalStream(tipo: "uint8array"): FlujoInterno }
            ).internalStream("uint8array");
            flujo
              .on("data", (trozo) => {
                parcial += trozo.length;
                if (parcial > maximo) {
                  flujo.pause();
                  rechazar(danada());
                }
              })
              .on("error", () => rechazar(danada()))
              .on("end", () => resolver(parcial))
              .resume();
          }),
      ),
    Promise.resolve(0),
  );

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
  // El tamaño declarado no basta: se comprueba el inflado real antes de cargar nada en memoria.
  await medirInflado(
    entradas.filter((e) => !e.dir),
    MAX_BYTES_DESCOMPRIMIDOS,
  );
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
    const clase = clasificarParteOffice(name);
    if (clase.clase === "xml") {
      let xml = await entrada.async("string");
      if (name === "[Content_Types].xml" || name.endsWith(".rels")) {
        xml = quitarReferenciasMetadatos(xml);
      }
      if (name.endsWith(".rels")) {
        const relaciones = neutralizarRelacionesExternas(xml);
        if (relaciones.cambio) eliminados.add(ETIQUETAS_OFFICE.rutas);
        xml = relaciones.xml;
      }
      const limpio = limpiarXmlOffice(name, xml);
      limpio.eliminados.forEach((e) => eliminados.add(e));
      zip.file(name, limpio.xml);
      // Lo que sobreviva en el texto final no se da por limpio: se reporta y provoca el rechazo.
      rastrosEnXmlOffice(limpio.xml).forEach((r) => residuales.add(r));
    } else if (clase.clase === "imagen") {
      const limpia = await limpiarImagen(clase.tipo, await entrada.async("uint8array"));
      zip.file(name, limpia.bytes);
      limpia.residuales.forEach((r) => residuales.add(r));
      if (limpia.eliminados.length > 0) eliminados.add("Metadatos de imágenes incrustadas");
    } else if (clase.clase === "incrustado") {
      if (profundidad >= MAX_PROFUNDIDAD) {
        residuales.add("Documentos incrustados en demasiados niveles");
        continue;
      }
      const interno = await procesar(await entrada.async("uint8array"), profundidad + 1);
      zip.file(name, interno.bytes);
      interno.residuales.forEach((r) => residuales.add(r));
      if (interno.eliminados.length > 0) eliminados.add("Metadatos de documentos incrustados");
    } else if (clase.clase === "residual") {
      residuales.add(clase.motivo);
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

  if (Object.keys(zip.files).some(esParteDeMetadatosOffice)) {
    residuales.add(ETIQUETAS_OFFICE.propiedades);
  }
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
