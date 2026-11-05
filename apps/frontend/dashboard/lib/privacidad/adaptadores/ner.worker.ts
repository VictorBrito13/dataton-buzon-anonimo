import { env, pipeline } from "@huggingface/transformers";
import type { TokenNer } from "../dominio/ner";
import type { MensajeAlWorker, MensajeDelWorker } from "./protocolo-ner";

/**
 * Corre el modelo fuera del hilo principal. Todo sale del propio sitio
 * (scripts/descargar-modelo.mjs lo deja en public/modelos): la CSP prohíbe
 * cualquier otro origen y aquí tampoco se intenta.
 */
const MODELO = "Xenova/distilbert-base-multilingual-cased-ner-hrl";

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "/modelos/";
// Guarda el modelo en el navegador para que funcione sin conexión tras la primera carga.
env.useBrowserCache = true;

const onnx = env.backends.onnx;
if (onnx.wasm) {
  onnx.wasm.wasmPaths = {
    mjs: "/modelos/ort/ort-wasm-simd-threaded.asyncify.mjs",
    wasm: "/modelos/ort/ort-wasm-simd-threaded.asyncify.wasm",
  };
  // Varios hilos exigen cabeceras COOP/COEP que el sitio no envía.
  onnx.wasm.numThreads = 1;
}

type Clasificador = (texto: string, opciones: { ignore_labels: string[] }) => Promise<TokenNer[]>;

interface ProgresoDescarga {
  status: string;
  file?: string;
  progress?: number;
}

const ambito = self as unknown as {
  postMessage(mensaje: MensajeDelWorker): void;
  onmessage: ((evento: { data: MensajeAlWorker }) => void) | null;
};

let clasificador: Clasificador | null = null;

const cargar = async () => {
  const crear = pipeline as unknown as (
    tarea: string,
    modelo: string,
    opciones: { dtype: string; device: string; progress_callback: (p: ProgresoDescarga) => void },
  ) => Promise<Clasificador>;
  clasificador = await crear("token-classification", MODELO, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (progreso) => {
      if (progreso.status === "progress" && progreso.file?.endsWith(".onnx")) {
        ambito.postMessage({ tipo: "progreso", porcentaje: Math.round(progreso.progress ?? 0) });
      }
    },
  });
};

ambito.onmessage = async ({ data }) => {
  try {
    if (data.tipo === "cargar") {
      await cargar();
      ambito.postMessage({ tipo: "listo" });
    } else if (clasificador) {
      const resultados: TokenNer[][] = [];
      for (const fragmento of data.fragmentos) {
        const tokens = await clasificador(fragmento, { ignore_labels: [] });
        resultados.push(tokens.map(({ entity, score, word }) => ({ entity, score, word })));
      }
      ambito.postMessage({ tipo: "tokens", id: data.id, resultados });
    }
  } catch {
    // Sin detalles: el mensaje de error podría contener parte del texto analizado.
    ambito.postMessage({ tipo: "error" });
  }
};
