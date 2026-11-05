import { esquemaPow } from "@dataton/shared";
import express, { Router } from "express";
import type { VerificadorPow } from "../../../compartido/aplicacion/puertos.js";
import type { Semaforo } from "../../../compartido/dominio/semaforo.js";
import { HttpError } from "../../../errors/http-error.js";
import type { RecibirEvidencia } from "../aplicacion/recibir-evidencia.js";

export const crearRutasEvidencias = (config: {
  recibir: RecibirEvidencia;
  pow: VerificadorPow;
  maxBytes: number;
  /** Limpiezas simultáneas: el resto espera un tiempo acotado y luego recibe 503. */
  semaforo: Semaforo;
}): Router => {
  const rutas = Router();
  rutas.post(
    "/",
    // La prueba de trabajo va antes de leer el cuerpo: sin ella no se reserva memoria ni lugar.
    async (req, _res, next) => {
      const pow = esquemaPow.safeParse(req.query.pow);
      if (!pow.success || !(await config.pow.consumir(pow.data))) {
        throw new HttpError(403, "La verificación expiró. Inténtalo de nuevo.");
      }
      next();
    },
    // El lugar se toma antes de leer el cuerpo y se devuelve al cerrar la respuesta, pase lo que pase.
    async (_req, res, next) => {
      const liberar = await config.semaforo.adquirir();
      if (!liberar) {
        throw new HttpError(503, "Hay muchas personas enviando archivos. Inténtalo en un momento.");
      }
      res.once("close", liberar);
      next();
    },
    // El tipo declarado se ignora: lo que cuenta son los bytes.
    express.raw({ type: () => true, limit: config.maxBytes }),
    async (req, res) => {
      const bytes: unknown = req.body;
      const archivo = Buffer.isBuffer(bytes) ? new Uint8Array(bytes) : new Uint8Array(0);
      res.status(201).json(await config.recibir.ejecutar(archivo));
    },
  );
  return rutas;
};
