#!/usr/bin/env node
/**
 * Mide las rutas públicas contra el despliegue real con Playwright y CDP: LCP, INP, CLS y peso.
 * Cada corrida usa un contexto nuevo, sin caché. Los tiempos varían: esto documenta, no es una
 * barrera de CI (la barrera estable es scripts/verificar-presupuesto-js.mjs).
 *
 * Uso: node scripts/rendimiento/medir-rutas.mjs --base https://localhost:3943 --salida rutas.json
 *      [--repeticiones 3] [--rutas /,/denunciar] [--cpu 4,6] [--red slow4g,slow3g]
 */
import { writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const opcion = (nombre, predeterminado) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? predeterminado : process.argv[i + 1];
};

const BASE = opcion("base", "https://localhost:3943");
const SALIDA = opcion("salida", "rutas.json");
const REPETICIONES = Number(opcion("repeticiones", "3"));
const RUTAS = opcion("rutas", "/,/denunciar,/seguimiento,/tablero,/como-te-protegemos").split(",");
const CPUS = opcion("cpu", "4,6").split(",").map(Number);
const REDES_PEDIDAS = opcion("red", "slow4g,slow3g").split(",");

/**
 * Valores de DevTools. Su antiguo "Fast 3G" se renombró "Slow 4G": son el mismo perfil, y son los
 * que usa Lighthouse en móvil. Por eso el segundo perfil es "Slow 3G", el que sí representa mala señal.
 */
const REDES = {
  slow4g: {
    offline: false,
    downloadThroughput: ((1.6 * 1000 * 1000) / 8) * 0.9,
    uploadThroughput: ((750 * 1000) / 8) * 0.9,
    latency: 150 * 3.75,
  },
  slow3g: {
    offline: false,
    downloadThroughput: ((500 * 1000) / 8) * 0.8,
    uploadThroughput: ((500 * 1000) / 8) * 0.8,
    latency: 400 * 5,
  },
};

const mediana = (valores) => {
  const orden = valores.filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
  if (orden.length === 0) return null;
  return orden[Math.floor((orden.length - 1) / 2)];
};

/** Corre antes que la página. Por CDP no lo bloquea la CSP. */
const instrumentar = () => {
  const m = { lcp: null, cortes: [], interacciones: {}, largas: [] };
  window.__medidas = m;
  const observar = (type, alRecibir, extra = {}) => {
    try {
      new PerformanceObserver((lista) => lista.getEntries().forEach(alRecibir)).observe({
        type,
        buffered: true,
        ...extra,
      });
    } catch {
      // Tipo no disponible en este navegador.
    }
  };
  observar("largest-contentful-paint", (e) => {
    m.lcp = e.startTime;
    m.lcpElemento = e.element?.tagName ?? null;
  });
  observar("layout-shift", (e) => {
    if (!e.hadRecentInput) m.cortes.push({ t: e.startTime, v: e.value });
  });
  observar("longtask", (e) => m.largas.push(e.duration));
  // El formulario de /denunciar solo existe en el cliente: su LCP no dice cuándo se puede usar.
  const vigiaFormulario = new MutationObserver(() => {
    if (location.pathname === "/denunciar" && document.querySelector("main select")) {
      m.formulario = performance.now();
      vigiaFormulario.disconnect();
    }
  });
  addEventListener("DOMContentLoaded", () =>
    vigiaFormulario.observe(document.body, { subtree: true, childList: true }),
  );
  observar(
    "event",
    (e) => {
      if (!e.interactionId) return;
      const previo = m.interacciones[e.interactionId] ?? 0;
      m.interacciones[e.interactionId] = Math.max(previo, e.duration);
    },
    { durationThreshold: 16 },
  );
};

/** CLS con ventanas de sesión (separación menor a 1 s, máximo 5 s), como lo define web-vitals. */
const calcularCls = (cortes) => {
  let maximo = 0;
  let actual = 0;
  let inicio = 0;
  let ultimo = 0;
  for (const { t, v } of cortes) {
    if (actual === 0 || t - ultimo > 1000 || t - inicio > 5000) {
      actual = 0;
      inicio = t;
    }
    actual += v;
    ultimo = t;
    maximo = Math.max(maximo, actual);
  }
  return maximo;
};

const clasificar = (tipo, mime) => {
  if (tipo === "Document") return "html";
  if (tipo === "Script") return "js";
  if (tipo === "Stylesheet") return "css";
  if (tipo === "Image") return "imagen";
  if (tipo === "Font") return "fuente";
  if (mime?.includes("json")) return "json";
  if (mime?.includes("javascript")) return "js";
  return "otro";
};

/** Interacciones reales con clic y teclado; el selector de tema existe en todas las rutas. */
const interactuar = async (pagina, ruta) => {
  const resumen = pagina.locator("details summary").first();
  await resumen.click({ timeout: 20_000 }).catch(() => {});
  await pagina
    .getByRole("radio", { name: "Oscuro" })
    .first()
    .click({ timeout: 10_000 })
    .catch(() => {});
  await pagina.keyboard.press("Escape");
  if (ruta === "/denunciar") {
    await pagina.getByRole("button", { name: "Continuar" }).click({ timeout: 10_000 });
    const relato = pagina.getByLabel("Cuéntanos qué pasó");
    await relato.click({ timeout: 10_000 });
    await pagina.keyboard.type("Hechos sintéticos para medir", { delay: 30 });
  }
  if (ruta === "/seguimiento") {
    await pagina.getByRole("tab", { name: "Con mi frase" }).click({ timeout: 10_000 });
    await pagina.keyboard.press("Tab");
    await pagina.keyboard.type("casa perro", { delay: 30 });
  }
};

const medirCarga = async (navegador, ruta, cpu, red, conRepetida) => {
  const contexto = await navegador.newContext({
    ...devices["Moto G Power"],
    ignoreHTTPSErrors: true,
    baseURL: BASE,
  });
  const pagina = await contexto.newPage();
  const cdp = await contexto.newCDPSession(pagina);
  const erroresCsp = [];
  pagina.on("console", (mensaje) => {
    if (/content security policy/i.test(mensaje.text())) erroresCsp.push(mensaje.text());
  });
  await pagina.addInitScript(instrumentar);

  const peticiones = new Map();
  let enCurso = 0;
  let ultimoCambio = performance.now();
  cdp.on("Network.requestWillBeSent", ({ requestId, request }) => {
    if (!peticiones.has(requestId)) enCurso += 1;
    peticiones.set(requestId, { url: request.url, bytes: 0, tipo: "otro" });
    ultimoCambio = performance.now();
  });
  cdp.on("Network.responseReceived", ({ requestId, type, response }) => {
    const p = peticiones.get(requestId);
    if (p) {
      p.tipo = clasificar(type, response.mimeType);
      p.estado = response.status;
    }
  });
  const cerrar = (requestId, bytes) => {
    const p = peticiones.get(requestId);
    if (p && !p.cerrada) {
      p.cerrada = true;
      p.bytes = bytes;
      enCurso -= 1;
    }
    ultimoCambio = performance.now();
  };
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) =>
    cerrar(requestId, encodedDataLength),
  );
  cdp.on("Network.loadingFailed", ({ requestId }) => cerrar(requestId, 0));

  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", REDES[red]);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });

  const inicio = performance.now();
  await pagina.goto(ruta, { waitUntil: "load", timeout: 120_000 });
  // Quietud de red: Next deja abierta alguna precarga, por lo que hay un tope.
  while (performance.now() - inicio < 60_000) {
    if (enCurso <= 0 && performance.now() - ultimoCambio > 1_500) break;
    await new Promise((resolver) => setTimeout(resolver, 200));
  }

  let formularioMs = null;
  if (ruta === "/denunciar") {
    await pagina.getByLabel("¿En qué estado pasó?").waitFor({ timeout: 60_000 });
    formularioMs = await pagina.evaluate(() => window.__medidas.formulario ?? null);
  }

  const porTipo = {};
  let total = 0;
  const lista = [...peticiones.values()].filter((p) => !p.url.startsWith("data:"));
  for (const p of lista) {
    porTipo[p.tipo] = (porTipo[p.tipo] ?? 0) + p.bytes;
    total += p.bytes;
  }
  const catalogos = lista
    .filter((p) => p.url.includes("/catalogos/"))
    .map((p) => new URL(p.url).pathname);
  const pesoJs = porTipo.js ?? 0;

  await interactuar(pagina, ruta);
  await pagina.waitForTimeout(800);

  const tiempos = await pagina.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return {
      ttfb: nav?.responseStart ?? null,
      fcp: fcp?.startTime ?? null,
      carga: nav?.loadEventEnd ?? null,
      medidas: window.__medidas,
    };
  });

  const duraciones = Object.values(tiempos.medidas.interacciones);
  const resultado = {
    ttfb: tiempos.ttfb,
    fcp: tiempos.fcp,
    lcp: tiempos.medidas.lcp,
    lcpElemento: tiempos.medidas.lcpElemento,
    cls: calcularCls(tiempos.medidas.cortes),
    tbt: tiempos.medidas.largas.reduce((s, d) => s + Math.max(0, d - 50), 0),
    inp: duraciones.length ? Math.max(...duraciones) : null,
    interacciones: duraciones.length,
    carga: tiempos.carga,
    formularioMs,
    total,
    pesoJs,
    porTipo,
    peticiones: lista.length,
    catalogos,
    erroresCsp,
    mayores: lista
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8)
      .map((p) => ({ url: new URL(p.url).pathname, bytes: p.bytes, tipo: p.tipo })),
  };

  if (conRepetida) {
    // Segunda visita con la caché del contexto: dice cuánto ahorra la caché larga.
    peticiones.clear();
    enCurso = 0;
    ultimoCambio = performance.now();
    await pagina.goto(ruta, { waitUntil: "load", timeout: 120_000 });
    const inicioRepetida = performance.now();
    while (performance.now() - inicioRepetida < 30_000) {
      if (enCurso <= 0 && performance.now() - ultimoCambio > 1_500) break;
      await new Promise((resolver) => setTimeout(resolver, 200));
    }
    resultado.repetida = {
      total: [...peticiones.values()].reduce((s, p) => s + p.bytes, 0),
      lcp: await pagina.evaluate(() => window.__medidas.lcp),
    };
  }

  await contexto.close();
  return resultado;
};

const navegador = await chromium.launch();
const filas = [];
for (const red of REDES_PEDIDAS) {
  for (const cpu of CPUS) {
    for (const ruta of RUTAS) {
      const corridas = [];
      for (let i = 0; i < REPETICIONES; i += 1) {
        corridas.push(await medirCarga(navegador, ruta, cpu, red, i === 0));
      }
      const claves = ["ttfb", "fcp", "lcp", "cls", "tbt", "inp", "carga", "total", "pesoJs"];
      const fila = {
        red,
        cpu,
        ruta,
        repeticiones: REPETICIONES,
        ...Object.fromEntries(claves.map((c) => [c, mediana(corridas.map((r) => r[c]))])),
        lcpElemento: corridas[0].lcpElemento,
        repetida: corridas[0].repetida,
        formularioMs: mediana(corridas.map((r) => r.formularioMs)),
        porTipo: corridas.at(-1).porTipo,
        peticiones: corridas.at(-1).peticiones,
        catalogos: corridas.at(-1).catalogos,
        mayores: corridas.at(-1).mayores,
        erroresCsp: corridas.flatMap((r) => r.erroresCsp),
      };
      filas.push(fila);
      console.log(
        `${red} ${cpu}x ${ruta}: LCP ${fila.lcp?.toFixed(0)} ms, INP ${fila.inp?.toFixed(0)} ms, ` +
          `CLS ${fila.cls?.toFixed(3)}, ${(fila.total / 1024).toFixed(0)} KB ` +
          `(JS ${(fila.pesoJs / 1024).toFixed(0)} KB), CSP ${fila.erroresCsp.length}`,
      );
      writeFileSync(
        SALIDA,
        JSON.stringify({ fecha: new Date().toISOString(), base: BASE, filas }, null, 2),
      );
    }
  }
}
await navegador.close();
