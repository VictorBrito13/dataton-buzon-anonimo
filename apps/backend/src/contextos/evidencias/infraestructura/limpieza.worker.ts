import { parentPort, workerData } from "node:worker_threads";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import type { RespuestaWorker, TrabajoLimpieza } from "./limpiador-en-worker.js";
import { limpiarOffice } from "./limpiador-office.js";
import { limpiarPdf } from "./limpiador-pdf.js";

/**
 * Punto de entrada del worker: recibe un trabajo en `workerData`, limpia y responde una sola vez.
 * Un `ErrorDominio` no sobrevive al cruce de hilos como instancia, por eso viaja como código y
 * mensaje; cualquier otro fallo se reporta como archivo dañado, sin detalles.
 */
const { categoria, bytes } = workerData as TrabajoLimpieza;

const responder = (respuesta: RespuestaWorker): void => {
  parentPort?.postMessage(respuesta);
};

(categoria === "pdf" ? limpiarPdf(bytes) : limpiarOffice(bytes)).then(
  (resultado) => responder({ ok: true, resultado }),
  (error: unknown) =>
    responder(
      error instanceof ErrorDominio
        ? { ok: false, codigo: error.codigo, mensaje: error.message }
        : { ok: false, codigo: "evidencia_danada", mensaje: "No pudimos procesar este archivo." },
    ),
);
