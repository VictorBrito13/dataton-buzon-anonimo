#!/usr/bin/env node
/**
 * Búsqueda de institución en /denunciar con CPU frenada y mala red: cuándo baja el catálogo, cuánto
 * tarda en verse el primer resultado, qué tan larga es la tarea que congela la pantalla y qué sale a la red.
 * Uso: node scripts/rendimiento/medir-entes.mjs --base https://localhost:3943 --salida entes.json
 */
import { writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const opcion = (nombre, predeterminado) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? predeterminado : process.argv[i + 1];
};
const BASE = opcion("base", "https://localhost:3943");
const SALIDA = opcion("salida", "entes.json");
const REPETICIONES = Number(opcion("repeticiones", "3"));
const CONSULTA = "secretaria";

const SLOW_4G = {
  offline: false,
  downloadThroughput: ((1.6 * 1000 * 1000) / 8) * 0.9,
  uploadThroughput: ((750 * 1000) / 8) * 0.9,
  latency: 150 * 3.75,
};

const instrumentar = () => {
  window.__e = { largas: [], eventos: [] };
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => window.__e.largas.push({ t: e.startTime, d: e.duration })),
  ).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => {
      if (e.interactionId) window.__e.eventos.push({ t: e.startTime, d: e.duration });
    }),
  ).observe({ type: "event", durationThreshold: 16 });
};

const medir = async (navegador, cpu) => {
  const contexto = await navegador.newContext({
    ...devices["Moto G Power"],
    ignoreHTTPSErrors: true,
    baseURL: BASE,
  });
  const pagina = await contexto.newPage();
  const cdp = await contexto.newCDPSession(pagina);
  await pagina.addInitScript(instrumentar);
  const salidas = [];
  const bytes = new Map();
  await cdp.send("Network.enable");
  cdp.on("Network.requestWillBeSent", ({ requestId, request }) => {
    salidas.push({ id: requestId, url: request.url, cuerpo: request.postData ?? "" });
  });
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    bytes.set(requestId, encodedDataLength);
  });
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });

  await pagina.goto("/denunciar", { waitUntil: "load", timeout: 120_000 });
  const buscador = pagina.getByLabel(/Institución involucrada/);
  await buscador.waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(1_500);
  const pideEntes = () => salidas.some((s) => s.url.includes("/catalogos/entes.json"));
  const alCargar = pideEntes();

  await buscador.click();
  await pagina.waitForTimeout(1_500);
  const alEnfocar = pideEntes();

  const hitoInicio = await pagina.evaluate(() => performance.now());
  const inicio = performance.now();
  await pagina.keyboard.type(CONSULTA, { delay: 80 });
  await pagina
    .getByRole("list", { name: "Instituciones encontradas" })
    .waitFor({ timeout: 60_000 });
  const resultadosMs = performance.now() - inicio;
  await pagina.waitForTimeout(500);

  const { largas, eventos } = await pagina.evaluate(() => window.__e);
  const largasBusqueda = largas.filter((l) => l.t >= hitoInicio - 1_500);
  const entes = salidas.find((s) => s.url.includes("/catalogos/entes.json"));
  const textoEnRed = salidas.some((s) =>
    (s.url + s.cuerpo).toLowerCase().includes(CONSULTA.slice(0, 5)),
  );
  await contexto.close();
  return {
    alCargar,
    alEnfocar,
    resultadosMs,
    bytesEntes: entes ? (bytes.get(entes.id) ?? null) : null,
    tareaLargaMaxMs: largasBusqueda.length ? Math.max(...largasBusqueda.map((l) => l.d)) : 0,
    inpMs: eventos.length
      ? Math.max(...eventos.filter((e) => e.t >= hitoInicio).map((e) => e.d), 0)
      : 0,
    textoEnRed,
  };
};

const mediana = (v) => [...v].sort((a, b) => a - b)[Math.floor((v.length - 1) / 2)];

const navegador = await chromium.launch();
const filas = [];
for (const cpu of [4, 6]) {
  const corridas = [];
  for (let i = 0; i < REPETICIONES; i += 1) corridas.push(await medir(navegador, cpu));
  const fila = {
    cpu,
    ...corridas[0],
    resultadosMs: mediana(corridas.map((c) => c.resultadosMs)),
    tareaLargaMaxMs: mediana(corridas.map((c) => c.tareaLargaMaxMs)),
    inpMs: mediana(corridas.map((c) => c.inpMs)),
  };
  filas.push(fila);
  console.log(fila);
}
await navegador.close();
writeFileSync(SALIDA, JSON.stringify({ fecha: new Date().toISOString(), filas }, null, 2));
