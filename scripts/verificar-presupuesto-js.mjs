#!/usr/bin/env node
/**
 * Falla si el JavaScript de carga inicial de una ruta crece demasiado o si una biblioteca pesada
 * entra en ella. Se corre después de `npm run build`. Las cifras de tiempo viven en
 * docs/evidencia/rendimiento.md; aquí solo hay bytes, para que la barrera no sea inestable.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { evaluarPresupuesto, formatearInforme } from "./presupuesto-js.mjs";

const RAIZ = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const NEXT = path.join(RAIZ, "apps/frontend/dashboard/.next");

/**
 * Límite en KB de gzip. Es la cifra real (ver docs/evidencia/rendimiento.md) más un margen de cerca
 * de 10%. Si subirlo es necesario, que quede explicado en el PR.
 */
const PRESUPUESTO = {
  rutas: {
    "/": 150,
    "/denunciar": 190,
    "/seguimiento": 160,
    "/tablero": 150,
    "/como-te-protegemos": 150,
    "/autoridad": 195,
  },
  // Estas se importan al usarse. Las firmas son textos que sobreviven a la minificación.
  prohibidoEnCargaInicial: {
    "pdf-lib": "PDFDocument",
    jszip: "JSZip",
    "Transformers.js": "onnxruntime",
    qrcode: "QR Code",
  },
};

const leerManifiesto = (ruta) => {
  const relativa = ruta === "/" ? "page" : `${ruta.slice(1)}/page`;
  const archivo = path.join(NEXT, "server/app", `${relativa}_client-reference-manifest.js`);
  if (!existsSync(archivo)) return null;
  const contexto = { globalThis: {} };
  vm.runInNewContext(readFileSync(archivo, "utf8"), contexto);
  return Object.values(contexto.globalThis.__RSC_MANIFEST ?? {})[0] ?? null;
};

const medirArchivo = (relativo) => {
  const contenido = readFileSync(path.join(NEXT, relativo));
  return {
    nombre: relativo,
    gzipBytes: gzipSync(contenido).length,
    contenido: contenido.toString("utf8"),
  };
};

const compilacion = path.join(NEXT, "build-manifest.json");
if (!existsSync(compilacion)) {
  console.error("Falta la compilación de Next: corre `npm run build` primero.");
  process.exit(1);
}
const { rootMainFiles = [] } = JSON.parse(readFileSync(compilacion, "utf8"));

const medidas = Object.keys(PRESUPUESTO.rutas).flatMap((ruta) => {
  const manifiesto = leerManifiesto(ruta);
  if (!manifiesto?.entryJSFiles) return [];
  const propios = Object.values(manifiesto.entryJSFiles).flat();
  return [{ ruta, archivos: [...rootMainFiles, ...propios].map(medirArchivo) }];
});

const { fallas, filas } = evaluarPresupuesto(medidas, PRESUPUESTO);
console.log(formatearInforme(filas));
if (fallas.length > 0) {
  console.error(`\nPresupuesto de JavaScript excedido:\n- ${fallas.join("\n- ")}`);
  process.exit(1);
}
