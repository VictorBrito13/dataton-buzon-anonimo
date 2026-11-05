/**
 * Contrato de la librería de privacidad en el cliente. Todo se ejecuta en el
 * navegador. Esta fachada une el dominio (reglas y limpiadores, sin DOM ni red)
 * con los adaptadores de navegador (canvas y Worker). La única red que se usa es
 * la carga opcional del modelo, y solo desde el propio sitio.
 */
import { crearClienteNer } from "./adaptadores/ner-cliente";
import type { EstadoModeloNer, ProgresoNer, WorkerNer } from "./adaptadores/protocolo-ner";
import { recodificarConCanvas } from "./adaptadores/canvas";
import { detectarContexto } from "./dominio/contexto";
import type { Hallazgo } from "./dominio/hallazgo";
import { ErrorLimpieza } from "./dominio/limpieza/errores";
import { detectarFormato, motivoDeRechazo } from "./dominio/limpieza/formato";
import { esAnimada, limpiarImagen, type FormatoImagen } from "./dominio/limpieza/imagen";
import { detectarDatos } from "./dominio/reglas";
import { resolverSolapes } from "./dominio/solapes";

export type { Hallazgo, TipoHallazgo } from "./dominio/hallazgo";
export type { EstadoModeloNer, ProgresoNer } from "./adaptadores/protocolo-ner";
export { ErrorLimpieza };

export interface ResultadoLimpieza {
  archivo: File;
  /** Metadatos eliminados, en lenguaje claro: "Ubicación GPS", "Autor". */
  eliminados: string[];
}

const clienteNer = crearClienteNer(
  () =>
    new Worker(new URL("./adaptadores/ner.worker.ts", import.meta.url), {
      type: "module",
    }) as unknown as WorkerNer,
);

/**
 * Capa 2 opcional. Resuelve en false si no se pudo cargar: nunca lanza, y las
 * reglas siguen funcionando. Pesa alrededor de 160 MB: pídela solo a petición de
 * la persona.
 */
export const cargarModeloNer = (alProgreso?: (progreso: ProgresoNer) => void): Promise<boolean> =>
  clienteNer.cargar(alProgreso);

export const estadoModeloNer = (): EstadoModeloNer => clienteNer.estado();

/** Detiene la descarga o el análisis y libera el modelo. Lo ya guardado en caché permanece. */
export const cancelarModeloNer = (): void => clienteNer.cancelar();

/** Reglas y contexto siempre; el modelo solo si ya se cargó. */
export const escanearTexto = async (texto: string): Promise<Hallazgo[]> => {
  const siempre = [...detectarDatos(texto), ...detectarContexto(texto)];
  return resolverSolapes([...siempre, ...(await clienteNer.analizar(texto))]);
};

const DATOS_DE_SALIDA: Record<FormatoImagen | "pdf" | "docx" | "xlsx" | "pptx", [string, string]> =
  {
    jpeg: ["jpg", "image/jpeg"],
    png: ["png", "image/png"],
    webp: ["webp", "image/webp"],
    pdf: ["pdf", "application/pdf"],
    docx: ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    xlsx: ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    pptx: ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  };

const limpiarImagenConCanvas = async (bytes: Uint8Array, formato: FormatoImagen) => {
  const limpio = limpiarImagen(bytes, formato);
  if (esAnimada(limpio.bytes, formato)) return limpio;
  const recodificada = await recodificarConCanvas(limpio.bytes, formato);
  if (!recodificada) return limpio;
  // Se revisa lo que entrega el navegador: tampoco se confía en él.
  return { bytes: limpiarImagen(recodificada, formato).bytes, eliminados: limpio.eliminados };
};

const limpiarSegunFormato = async (bytes: Uint8Array) => {
  const formato = detectarFormato(bytes);
  if (formato === null) throw new ErrorLimpieza(motivoDeRechazo(bytes));
  if (formato === "pdf") {
    const { limpiarPdf } = await import("./dominio/limpieza/pdf");
    return { ...(await limpiarPdf(bytes)), salida: DATOS_DE_SALIDA.pdf };
  }
  if (formato === "office") {
    const { limpiarOffice } = await import("./dominio/limpieza/office");
    const limpio = await limpiarOffice(bytes);
    return { ...limpio, salida: DATOS_DE_SALIDA[limpio.tipo] };
  }
  return { ...(await limpiarImagenConCanvas(bytes, formato)), salida: DATOS_DE_SALIDA[formato] };
};

/**
 * Quita los metadatos de una evidencia. Lanza ErrorLimpieza, con un mensaje apto
 * para la persona, si no se puede limpiar: nunca devuelve el original como limpio.
 * El archivo resultante se llama "evidencia.<ext>", porque el nombre también identifica.
 */
export const limpiarArchivo = async (archivo: File): Promise<ResultadoLimpieza> => {
  try {
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const { bytes: limpios, eliminados, salida } = await limpiarSegunFormato(bytes);
    const [extension, tipo] = salida;
    const nombre = `evidencia.${extension}`;
    const lista = [...eliminados];
    if (archivo.name !== nombre) lista.push("Nombre original del archivo");
    if (archivo.lastModified !== 0) lista.push("Fecha de modificación del archivo");
    return {
      archivo: new File([limpios as BlobPart], nombre, { type: tipo, lastModified: 0 }),
      eliminados: lista,
    };
  } catch (error) {
    if (error instanceof ErrorLimpieza) throw error;
    throw new ErrorLimpieza("No se pudo limpiar este archivo, así que no se puede subir.");
  }
};
