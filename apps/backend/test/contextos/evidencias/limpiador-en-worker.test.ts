import { performance } from "node:perf_hooks";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { ErrorDominio } from "../../../src/compartido/dominio/errores.js";
import { LimpiadorEnWorker } from "../../../src/contextos/evidencias/infraestructura/limpiador-en-worker.js";
import {
  AUTOR,
  jpegConMetadatos,
  officeConMetadatos,
  pdfCifradoDeclarado,
  pdfConMetadatos,
  pdfDePaginasVacias,
} from "../../ayudas/fixtures.js";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const codigo = async (promesa: Promise<unknown>) =>
  promesa.then(
    () => undefined,
    (e: unknown) => (e instanceof ErrorDominio ? e.codigo : `otro: ${String(e)}`),
  );

/**
 * Mide el hilo principal mientras corre `trabajo`: un temporizador de 10 ms registra cuánto llegó
 * a retrasarse un latido, y `eventLoopUtilization` qué fracción del tiempo estuvo ocupado.
 */
const medirHiloPrincipal = async <T>(trabajo: () => Promise<T>) => {
  const INTERVALO = 10;
  let mayorRetrasoMs = 0;
  let ultimo = performance.now();
  const latido = setInterval(() => {
    const ahora = performance.now();
    mayorRetrasoMs = Math.max(mayorRetrasoMs, ahora - ultimo - INTERVALO);
    ultimo = ahora;
  }, INTERVALO);
  const utilizacionInicial = performance.eventLoopUtilization();
  const inicio = performance.now();
  try {
    return {
      resultado: await trabajo(),
      totalMs: performance.now() - inicio,
      mayorRetrasoMs,
      utilizacion: performance.eventLoopUtilization(utilizacionInicial).utilization,
    };
  } finally {
    clearInterval(latido);
  }
};

describe("LimpiadorEnWorker", () => {
  /** El PDF de la PoC: 100,000 páginas vacías, que pdf-lib tarda cerca de 2 s en analizar. */
  const cienMil = pdfDePaginasVacias(100_000);
  const limpiador = new LimpiadorEnWorker({ tiempoMaxMs: 60_000 });

  afterAll(() => {
    expect(limpiador.activos).toBe(0);
  });

  it("rechaza el PDF de 100,000 páginas sin ocupar el hilo principal", async () => {
    const medida = await medirHiloPrincipal(() => codigo(limpiador.limpiar(PDF, "pdf", cienMil)));
    expect(medida.resultado).toBe("evidencia_demasiado_compleja");
    // El análisis tarda más de un segundo de CPU; con el worker ese tiempo no es del hilo principal.
    expect(medida.totalMs).toBeGreaterThan(500);
    // En el hilo principal la misma medida da cerca de 30 % de utilización y retrasos de 30 ms.
    expect(medida.utilizacion).toBeLessThan(0.1);
    expect(medida.mayorRetrasoMs).toBeLessThan(100);
  }, 60_000);

  it("rechaza con un mensaje claro un archivo que excede el tiempo máximo y termina el worker", async () => {
    const impaciente = new LimpiadorEnWorker({ tiempoMaxMs: 150 });
    const inicio = performance.now();
    const error = await impaciente.limpiar(PDF, "pdf", cienMil).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ErrorDominio);
    expect((error as ErrorDominio).codigo).toBe("limpieza_demasiado_lenta");
    expect((error as ErrorDominio).message).toMatch(/tarda demasiado/);
    // No esperó a que el análisis terminara: respondió al vencer el plazo.
    expect(performance.now() - inicio).toBeLessThan(1_500);
    expect(impaciente.activos).toBe(0);
  }, 30_000);

  it("limpia un PDF en el worker con el mismo resultado que en el hilo principal", async () => {
    const salida = await limpiador.limpiar(PDF, "pdf", await pdfConMetadatos());
    expect(salida.bytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(salida.bytes).toString("latin1")).not.toContain(AUTOR);
    expect(salida.residuales).toEqual([]);
    expect(salida.eliminados.join(" | ")).toMatch(/autor/i);
    expect((await PDFDocument.load(salida.bytes)).getPageCount()).toBe(1);
  });

  it("limpia un documento de Office en el worker", async () => {
    const salida = await limpiador.limpiar(DOCX, "office", await officeConMetadatos());
    expect(Buffer.from(salida.bytes).toString("latin1")).not.toContain(AUTOR);
    expect(salida.eliminados.join(" | ")).toMatch(/propiedades/i);
    expect(salida.residuales).toEqual([]);
  });

  it("conserva el código de dominio de los rechazos que ocurren dentro del worker", async () => {
    expect(await codigo(limpiador.limpiar(PDF, "pdf", await pdfCifradoDeclarado()))).toBe(
      "evidencia_cifrada",
    );
    expect(await codigo(limpiador.limpiar(DOCX, "office", new TextEncoder().encode("PK no")))).toBe(
      "evidencia_danada",
    );
    const macro = await officeConMetadatos({ partes: { "word/vbaProject.bin": "x" } });
    expect(await codigo(limpiador.limpiar(DOCX, "office", macro))).toBe("contenido_activo");
  });

  it("las imágenes siguen en el hilo principal: sharp ya trabaja fuera de él", async () => {
    const salida = await limpiador.limpiar("image/jpeg", "imagen", await jpegConMetadatos());
    expect((await sharp(salida.bytes).metadata()).exif).toBeUndefined();
    expect(salida.eliminados.join(" ")).toMatch(/EXIF/);
  });
});
