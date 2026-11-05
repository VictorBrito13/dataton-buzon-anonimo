import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import type { Limpiador, ResultadoLimpieza } from "../aplicacion/puertos.js";
import type { CategoriaEvidencia } from "../dominio/politica.js";
import { limpiarImagen } from "./limpiador-imagen.js";

export interface TrabajoLimpieza {
  categoria: Exclude<CategoriaEvidencia, "imagen">;
  bytes: Uint8Array;
}

export type RespuestaWorker =
  { ok: true; resultado: ResultadoLimpieza } | { ok: false; codigo: string; mensaje: string };

export interface OpcionesLimpiadorEnWorker {
  /** Al vencer, el worker se termina y el archivo se rechaza: nada sigue ocupando CPU. */
  tiempoMaxMs: number;
  /** Memoria del montón del worker. Si la rebasa, muere solo él, no el servidor. */
  memoriaMaxMb?: number;
}

/**
 * En desarrollo (`tsx`) y en Vitest el archivo del worker es `.ts`; compilado, `.js`. Con `tsx` el
 * worker hereda su cargador en `execArgv`; en Vitest hay que pedirlo. Compilado, el worker arranca
 * sin banderas heredadas: en la imagen de producción solo existe `dist/` y no se toca nada de esto.
 */
const ES_FUENTE_TS = import.meta.url.endsWith(".ts");
const ARCHIVO_WORKER = new URL(`./limpieza.worker.${ES_FUENTE_TS ? "ts" : "js"}`, import.meta.url);

const argumentosDelWorker = (): string[] | undefined => {
  if (!ES_FUENTE_TS) return [];
  if (process.execArgv.some((argumento) => /[\\/]tsx[\\/]/.test(argumento))) return undefined;
  return ["--import", pathToFileURL(createRequire(import.meta.url).resolve("tsx")).href];
};

const EXEC_ARGV = argumentosDelWorker();

const demasiadoLenta = (): ErrorDominio =>
  new ErrorDominio(
    "limpieza_demasiado_lenta",
    "Este archivo tarda demasiado en procesarse y no se puede aceptar. Prueba con una versión más sencilla.",
  );

const sinMemoria = (): ErrorDominio =>
  new ErrorDominio(
    "evidencia_demasiado_compleja",
    "Este archivo necesita demasiada memoria para procesarse y no se puede aceptar.",
  );

const danada = (): ErrorDominio =>
  new ErrorDominio("evidencia_danada", "No pudimos procesar este archivo.");

/**
 * Limpia PDF y Office en un `worker_threads` por archivo, con tiempo y memoria acotados, para que
 * el análisis de un archivo malicioso no ocupe el hilo que atiende al resto de las peticiones. Las
 * imágenes se quedan en el hilo principal: `sharp` ya trabaja fuera de él.
 */
export class LimpiadorEnWorker implements Limpiador {
  private enCurso = 0;

  constructor(private readonly opciones: OpcionesLimpiadorEnWorker) {}

  /** Workers vivos. Tras cada limpieza, resuelta o rechazada, vuelve a cero. */
  get activos(): number {
    return this.enCurso;
  }

  limpiar(
    tipo: string,
    categoria: CategoriaEvidencia,
    bytes: Uint8Array,
  ): Promise<ResultadoLimpieza> {
    if (categoria === "imagen") return limpiarImagen(tipo, bytes);
    return this.enWorker({ categoria, bytes });
  }

  private enWorker(trabajo: TrabajoLimpieza): Promise<ResultadoLimpieza> {
    this.enCurso += 1;
    return new Promise<ResultadoLimpieza>((resolver, rechazar) => {
      const worker = new Worker(ARCHIVO_WORKER, {
        workerData: trabajo,
        execArgv: EXEC_ARGV,
        resourceLimits: this.opciones.memoriaMaxMb
          ? { maxOldGenerationSizeMb: this.opciones.memoriaMaxMb }
          : undefined,
      });
      let concluido = false;
      const concluir = (desenlace: () => void): void => {
        if (concluido) return;
        concluido = true;
        clearTimeout(plazo);
        this.enCurso -= 1;
        desenlace();
      };
      const plazo = setTimeout(() => {
        // Primero se termina el worker: la respuesta no espera a que suelte la CPU.
        void worker.terminate();
        concluir(() => rechazar(demasiadoLenta()));
      }, this.opciones.tiempoMaxMs);

      worker.once("message", (respuesta: RespuestaWorker) => {
        concluir(() => {
          if (respuesta.ok) resolver(respuesta.resultado);
          else rechazar(new ErrorDominio(respuesta.codigo, respuesta.mensaje));
        });
        void worker.terminate();
      });
      worker.once("error", (error: NodeJS.ErrnoException) => {
        concluir(() =>
          rechazar(error.code === "ERR_WORKER_OUT_OF_MEMORY" ? sinMemoria() : danada()),
        );
      });
      // Salir sin haber respondido es un fallo del worker, no del archivo: se rechaza igual.
      worker.once("exit", () => concluir(() => rechazar(danada())));
    });
  }
}
