#!/usr/bin/env node
/**
 * Lighthouse con sus parámetros móviles por defecto (Slow 4G simulada, CPU 4×), desde una instalación
 * fuera del repositorio: no es dependencia del proyecto. Reporta la mediana de cada ruta.
 *
 * Uso: node scripts/rendimiento/medir-lighthouse.mjs --lighthouse <carpeta con node_modules/lighthouse>
 *      --base https://localhost:3943 --salida lighthouse.json [--repeticiones 3]
 */
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";

const ejecutar = promisify(execFile);

const opcion = (nombre, predeterminado) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? predeterminado : process.argv[i + 1];
};

const LIGHTHOUSE = opcion("lighthouse", null);
if (!LIGHTHOUSE) throw new Error("Falta --lighthouse <carpeta>");
const BASE = opcion("base", "https://localhost:3943");
const SALIDA = opcion("salida", "lighthouse.json");
const REPETICIONES = Number(opcion("repeticiones", "3"));
const RUTAS = opcion("rutas", "/,/denunciar,/seguimiento,/tablero,/como-te-protegemos").split(",");

const carpeta = mkdtempSync(join(tmpdir(), "lh-"));

const correr = async (ruta, i) => {
  const salida = join(carpeta, `${i}.json`);
  await ejecutar(
    process.execPath,
    [
      join(LIGHTHOUSE, "node_modules/lighthouse/cli/index.js"),
      `${BASE}${ruta}`,
      "--only-categories=performance",
      "--output=json",
      `--output-path=${salida}`,
      "--quiet",
      "--chrome-flags=--headless=new --no-sandbox --ignore-certificate-errors",
    ],
    {
      env: { ...process.env, CHROME_PATH: chromium.executablePath() },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const informe = JSON.parse(readFileSync(salida, "utf8"));
  const valor = (id) => informe.audits[id]?.numericValue ?? null;
  const porTipo = Object.fromEntries(
    (informe.audits["resource-summary"]?.details?.items ?? []).map((f) => [
      f.resourceType,
      f.transferSize,
    ]),
  );
  return {
    puntaje: Math.round((informe.categories.performance.score ?? 0) * 100),
    fcp: valor("first-contentful-paint"),
    lcp: valor("largest-contentful-paint"),
    tbt: valor("total-blocking-time"),
    cls: valor("cumulative-layout-shift"),
    si: valor("speed-index"),
    bytes: valor("total-byte-weight"),
    jsSinUsar: informe.audits["unused-javascript"]?.numericValue ?? null,
    porTipo,
    indiceReferencia: informe.environment?.benchmarkIndex ?? null,
    cpuSlowdown: informe.configSettings?.throttling?.cpuSlowdownMultiplier ?? null,
    metodo: informe.configSettings?.throttlingMethod ?? null,
    factorForma: informe.configSettings?.formFactor ?? null,
  };
};

const filas = [];
for (const ruta of RUTAS) {
  const corridas = [];
  for (let i = 0; i < REPETICIONES; i += 1) corridas.push(await correr(ruta, i));
  corridas.sort((a, b) => a.lcp - b.lcp);
  const fila = { ruta, ...corridas[Math.floor((corridas.length - 1) / 2)] };
  filas.push(fila);
  console.log(
    `${ruta}: puntaje ${fila.puntaje}, LCP ${fila.lcp?.toFixed(0)} ms, TBT ${fila.tbt?.toFixed(0)} ms, ` +
      `CLS ${fila.cls?.toFixed(3)}, ${(fila.bytes / 1024).toFixed(0)} KB, índice ${fila.indiceReferencia}`,
  );
  writeFileSync(
    SALIDA,
    JSON.stringify({ fecha: new Date().toISOString(), base: BASE, filas }, null, 2),
  );
}
rmSync(carpeta, { recursive: true, force: true });
