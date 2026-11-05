import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluarPresupuesto, formatearInforme } from "./presupuesto-js.mjs";

const archivo = (nombre, gzipKb, contenido = "") => ({
  nombre,
  gzipBytes: gzipKb * 1024,
  contenido,
});

const presupuesto = {
  rutas: { "/": 150, "/denunciar": 200 },
  prohibidoEnCargaInicial: { "pdf-lib": "PDFDocument", "Transformers.js": "onnxruntime" },
};

describe("evaluarPresupuesto", () => {
  it("pasa si cada ruta queda dentro de su límite", () => {
    const { fallas, filas } = evaluarPresupuesto(
      [
        { ruta: "/", archivos: [archivo("a.js", 100), archivo("b.js", 40)] },
        { ruta: "/denunciar", archivos: [archivo("a.js", 100), archivo("c.js", 50)] },
      ],
      presupuesto,
    );
    assert.deepEqual(fallas, []);
    assert.deepEqual(
      filas.map((f) => [f.ruta, f.kb]),
      [
        ["/", 140],
        ["/denunciar", 150],
      ],
    );
  });

  it("falla si una ruta se pasa de su límite, y dice por cuánto", () => {
    const { fallas } = evaluarPresupuesto(
      [
        { ruta: "/", archivos: [archivo("a.js", 151)] },
        { ruta: "/denunciar", archivos: [archivo("a.js", 100)] },
      ],
      presupuesto,
    );
    assert.equal(fallas.length, 1);
    assert.match(fallas[0], /\/: 151\.0 KB.*150 KB/);
  });

  it("falla si una biblioteca pesada entra en la carga inicial, aunque el total alcance", () => {
    const { fallas } = evaluarPresupuesto(
      [
        { ruta: "/", archivos: [archivo("a.js", 10, "x PDFDocument y")] },
        { ruta: "/denunciar", archivos: [archivo("a.js", 10)] },
      ],
      presupuesto,
    );
    assert.equal(fallas.length, 1);
    assert.match(fallas[0], /pdf-lib.*\//);
  });

  it("falla si falta una ruta con límite: un cambio en Next no debe apagar la barrera en silencio", () => {
    const { fallas } = evaluarPresupuesto(
      [{ ruta: "/", archivos: [archivo("a.js", 10)] }],
      presupuesto,
    );
    assert.equal(fallas.length, 1);
    assert.match(fallas[0], /\/denunciar/);
  });

  it("falla si una ruta no tiene archivos: leería cero y siempre pasaría", () => {
    const { fallas } = evaluarPresupuesto(
      [
        { ruta: "/", archivos: [] },
        { ruta: "/denunciar", archivos: [archivo("a.js", 10)] },
      ],
      presupuesto,
    );
    assert.equal(fallas.length, 1);
    assert.match(fallas[0], /\/: sin archivos/);
  });

  it("los archivos repetidos entre segmentos cuentan una sola vez, como los baja el navegador", () => {
    const { filas } = evaluarPresupuesto(
      [
        { ruta: "/", archivos: [archivo("a.js", 100), archivo("a.js", 100)] },
        { ruta: "/denunciar", archivos: [archivo("a.js", 10)] },
      ],
      presupuesto,
    );
    assert.equal(filas[0].kb, 100);
  });
});

describe("formatearInforme", () => {
  it("muestra uso y límite por ruta", () => {
    const texto = formatearInforme([{ ruta: "/", kb: 140, limiteKb: 150 }]);
    assert.match(texto, /\/\s+140\.0 KB de 150 KB/);
  });
});
