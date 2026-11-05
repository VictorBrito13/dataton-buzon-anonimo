import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { Semaforo } from "../../../src/compartido/dominio/semaforo.js";
import type { RecibirEvidencia } from "../../../src/contextos/evidencias/aplicacion/recibir-evidencia.js";
import { crearRutasEvidencias } from "../../../src/contextos/evidencias/infraestructura/rutas.js";
import { errorHandler } from "../../../src/middlewares/error.middleware.js";

/** Un caso de uso que no termina hasta que la prueba lo suelte: simula una limpieza lenta. */
const armar = (semaforo: Semaforo) => {
  let soltar: () => void = () => {};
  const bloqueo = new Promise<void>((r) => (soltar = r));
  const recibir = {
    ejecutar: async () => {
      await bloqueo;
      return { evidenciaId: "e1", metadatosEliminadosEnServidor: [] };
    },
  } as unknown as RecibirEvidencia;
  const app = express();
  app.use(
    "/evidencias",
    crearRutasEvidencias({
      recibir,
      pow: { consumir: (pow) => Promise.resolve(pow === "ok") },
      maxBytes: 1000,
      semaforo,
    }),
  );
  app.use(errorHandler);
  const subir = (pow = "ok") =>
    request(app).post("/evidencias").query({ pow }).set("Content-Type", "image/jpeg").send("x");
  return { app, subir, soltar: () => soltar() };
};

describe("POST /evidencias con limpiezas acotadas", () => {
  it("responde 503 a quien no alcanza lugar tras la espera máxima, y 201 al resto", async () => {
    const semaforo = new Semaforo({ maximo: 2, esperaMaxMs: 50 });
    const { subir, soltar } = armar(semaforo);
    // supertest no dispara la petición hasta que alguien la espera.
    const enCurso = [Promise.resolve(subir()), Promise.resolve(subir())];
    await new Promise((r) => setTimeout(r, 20));
    expect(semaforo.ocupados).toBe(2);
    const rechazada = await subir();
    expect(rechazada.status).toBe(503);
    expect(rechazada.text).not.toMatch(/stack|node_modules/);
    soltar();
    const respuestas = await Promise.all(enCurso);
    expect(respuestas.map((r) => r.status)).toEqual([201, 201]);
    expect(semaforo.ocupados).toBe(0);
  });

  it("libera el lugar también cuando la petición falla antes de limpiar", async () => {
    const semaforo = new Semaforo({ maximo: 1, esperaMaxMs: 50 });
    const { app } = armar(semaforo);
    await request(app)
      .post("/evidencias")
      .query({ pow: "ok" })
      .set("Content-Type", "image/jpeg")
      .send(Buffer.alloc(5000))
      .expect(413);
    expect(semaforo.ocupados).toBe(0);
  });

  it("no ocupa lugar sin prueba de trabajo válida", async () => {
    const semaforo = new Semaforo({ maximo: 1, esperaMaxMs: 50 });
    const { subir } = armar(semaforo);
    await subir("mala").expect(403);
    expect(semaforo.ocupados).toBe(0);
  });
});
