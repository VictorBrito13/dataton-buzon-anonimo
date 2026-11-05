#!/usr/bin/env node
/**
 * Tiempo real desde "Enviar mi denuncia" hasta el folio: Argon2id y prueba de trabajo, con la API real.
 *
 * Emulation.setCPUThrottlingRate solo frena el hilo principal: ni el Worker ni WebCrypto se enteran
 * (CDP responde "Operation is only supported for pages, not workers"). Con solo CDP, Argon2id tardaría
 * lo mismo en 1× que en 6× y la cifra sería falsa. Por eso hay dos modos:
 *   - cdp: el que se pidió; deja constancia de que no alcanza al Worker.
 *   - so:  alterna SIGSTOP y SIGCONT sobre los procesos renderer de este navegador (por PID), y frena
 *          todos sus hilos. Una calibración con un bucle y con PBKDF2 en un Worker comprueba el factor.
 *
 * Uso: node scripts/rendimiento/medir-folio.mjs --base https://localhost:3943 --salida folio.json
 *      [--repeticiones 5] [--modos sin:1,cdp:4,cdp:6,so:4,so:6]
 */
import { writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const opcion = (nombre, predeterminado) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? predeterminado : process.argv[i + 1];
};

const BASE = opcion("base", "https://localhost:3943");
const SALIDA = opcion("salida", "folio.json");
const REPETICIONES = Number(opcion("repeticiones", "5"));
/** Tiempo que la persona lee el último paso antes de pulsar. Con 0 pulsa en cuanto aparece el botón. */
const LECTURA_MS = Number(opcion("lectura-ms", "0"));
const TIEMPO_EN_LA_FRASE_MS = Number(opcion("frase-ms", "15000"));
const MODOS = opcion("modos", "sin:1,cdp:4,cdp:6,so:4,so:6")
  .split(",")
  .map((m) => {
    const [modo, factor] = m.split(":");
    return { modo, factor: Number(factor) };
  });

const SLOW_4G = {
  offline: false,
  downloadThroughput: ((1.6 * 1000 * 1000) / 8) * 0.9,
  uploadThroughput: ((750 * 1000) / 8) * 0.9,
  latency: 150 * 3.75,
};

/** Node llega alrededor de 1 ms tarde a cada espera; se descuenta para que el factor salga exacto. */
const PERIODO_MS = 60;
const RETRASO_TEMPORIZADOR_MS = 1;
const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/** Frena todos los hilos de los procesos dados. Devuelve la función que los deja como estaban. */
const frenarProcesos = (pids, factor) => {
  let activo = true;
  const senal = (nombre) => {
    for (const pid of pids) {
      try {
        process.kill(pid, nombre);
      } catch {
        // El proceso ya terminó.
      }
    }
  };
  const encendido = PERIODO_MS / factor - RETRASO_TEMPORIZADOR_MS;
  const apagado = PERIODO_MS - PERIODO_MS / factor - RETRASO_TEMPORIZADOR_MS;
  void (async () => {
    while (activo) {
      senal("SIGSTOP");
      await dormir(apagado);
      senal("SIGCONT");
      if (activo) await dormir(encendido);
    }
    senal("SIGCONT");
  })();
  return () => {
    activo = false;
    senal("SIGCONT");
  };
};

const procesosRenderer = async (navegador) => {
  const sesion = await navegador.newBrowserCDPSession();
  const { processInfo } = await sesion.send("SystemInfo.getProcessInfo");
  await sesion.detach();
  return processInfo.filter((p) => p.type === "renderer").map((p) => p.id);
};

const FUENTE_CALIBRACION = `
self.onmessage = async () => {
  const t0 = performance.now(); let x = 0; for (let i = 0; i < 2e8; i += 1) x = (x + i * i) | 0;
  const bucle = performance.now() - t0;
  const clave = await crypto.subtle.importKey("raw", new Uint8Array(16), "PBKDF2", false, ["deriveBits"]);
  const t1 = performance.now();
  for (let i = 0; i < 20; i += 1) await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new Uint8Array(16), iterations: 100000 }, clave, 256);
  self.postMessage({ bucle, pbkdf2: performance.now() - t1, x });
}`;

const calibrar = async (navegador, modo, factor) => {
  const contexto = await navegador.newContext({ ignoreHTTPSErrors: true });
  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}/como-te-protegemos`);
  const cdp = await contexto.newCDPSession(pagina);
  if (modo === "cdp") await cdp.send("Emulation.setCPUThrottlingRate", { rate: factor });
  const soltar = modo === "so" ? frenarProcesos(await procesosRenderer(navegador), factor) : null;
  const medida = await pagina.evaluate(async (fuente) => {
    const t0 = performance.now();
    let y = 0;
    for (let i = 0; i < 2e8; i += 1) y = (y + i * i) | 0;
    const hiloPrincipal = performance.now() - t0;
    const url = URL.createObjectURL(new Blob([fuente], { type: "text/javascript" }));
    const trabajador = new Worker(url);
    const datos = await new Promise((resolver, rechazar) => {
      trabajador.onmessage = (e) => resolver(e.data);
      trabajador.onerror = (e) => rechazar(new Error(e.message));
      trabajador.postMessage(1);
    });
    trabajador.terminate();
    return { hiloPrincipal, y, bucleWorker: datos.bucle, pbkdf2Worker: datos.pbkdf2 };
  }, FUENTE_CALIBRACION);
  soltar?.();
  await contexto.close();
  return medida;
};

const instrumentar = () => {
  const m = { etapas: [], latidos: { mayor: 0, ultimo: null }, largas: [], eventos: [] };
  window.__folio = m;
  let previo = "";
  const revisar = () => {
    const nodos = document.querySelectorAll('[role="status"]');
    const texto = [...nodos]
      .map((n) => n.textContent ?? "")
      .join(" | ")
      .trim();
    if (texto !== previo) {
      previo = texto;
      m.etapas.push({ t: performance.now(), texto });
    }
  };
  addEventListener("DOMContentLoaded", () => {
    new MutationObserver(revisar).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  new PerformanceObserver((lista) =>
    lista.getEntries().forEach((e) => m.largas.push({ t: e.startTime, d: e.duration })),
  ).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((lista) =>
    lista.getEntries().forEach((e) => {
      if (e.interactionId) m.eventos.push({ t: e.startTime, d: e.duration, nombre: e.name });
    }),
  ).observe({ type: "event", durationThreshold: 16 });
  setInterval(() => {
    const ahora = performance.now();
    if (m.latidos.ultimo !== null && m.latidos.vigilar) {
      m.latidos.mayor = Math.max(m.latidos.mayor, ahora - m.latidos.ultimo);
    }
    m.latidos.ultimo = ahora;
  }, 10);
};

const llenarFormulario = async (pagina, antesDeLaFrase) => {
  const continuar = pagina.getByRole("button", { name: "Continuar" });
  await pagina.getByLabel("¿En qué estado pasó?").selectOption("17");
  await pagina.getByLabel("¿Qué tipo de falta es?").selectOption("cohecho");
  await pagina.getByLabel("Mes").selectOption("03");
  await pagina.getByLabel("Año").selectOption("2026");
  await pagina
    .getByLabel("Cuéntanos qué pasó")
    .fill("Relato sintético de medición, no es un hecho real.");
  await continuar.click();
  for (const titulo of ["Personas o entes involucrados", "Evidencias", "Revisión"]) {
    await pagina.getByRole("heading", { name: titulo, level: 2 }).waitFor();
    if (titulo === "Revisión") await antesDeLaFrase();
    await continuar.click();
  }
  await pagina.getByRole("heading", { name: "Tu frase", level: 2 }).waitFor();
  const frase = (await pagina.locator(".area-impresion li .font-mono").allTextContents()).join(" ");
  await pagina.getByRole("button", { name: "Ya la guardé" }).click();
  const palabras = frase.split(" ");
  for (const campo of await pagina.getByLabel(/Palabra número/).all()) {
    const etiqueta = await campo.evaluate(
      (el) => document.querySelector(`label[for="${el.id}"]`)?.textContent ?? "",
    );
    await campo.fill(palabras[Number(/\d+/.exec(etiqueta)?.[0]) - 1] ?? "");
  }
  // Una persona tarda más que esto en leer y guardar seis palabras. Es deliberadamente conservador.
  await pagina.waitForTimeout(TIEMPO_EN_LA_FRASE_MS);
  await pagina.getByRole("button", { name: "Confirmar y continuar" }).click();
};

const medirEnvio = async (navegador, modo, factor) => {
  const contexto = await navegador.newContext({
    ...devices["Moto G Power"],
    ignoreHTTPSErrors: true,
    baseURL: BASE,
  });
  const pagina = await contexto.newPage();
  const cdp = await contexto.newCDPSession(pagina);
  const erroresCsp = [];
  pagina.on("console", (m) => {
    if (/content security policy/i.test(m.text())) erroresCsp.push(m.text());
  });
  let contador = null;
  pagina.on("request", (peticion) => {
    if (peticion.method() !== "POST" || !peticion.url().endsWith("/api/v1/denuncias")) return;
    try {
      const { pow } = JSON.parse(peticion.postData() ?? "{}");
      contador = JSON.parse(Buffer.from(pow, "base64").toString("utf8")).solution?.counter ?? null;
    } catch {
      contador = null;
    }
  });
  await pagina.addInitScript(instrumentar);
  await cdp.send("Network.enable");
  await pagina.goto("/denunciar", { waitUntil: "load", timeout: 120_000 });
  const peticionesEnvio = [];
  contexto.on("request", (peticion) => peticionesEnvio.push(new URL(peticion.url()).pathname));

  // Los frenos entran antes del paso de la frase: lo que se baja ahí también viaja con mala señal.
  let soltar = null;
  await llenarFormulario(pagina, async () => {
    await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
    if (modo === "cdp") await cdp.send("Emulation.setCPUThrottlingRate", { rate: factor });
    if (modo === "so") soltar = frenarProcesos(await procesosRenderer(navegador), factor);
  });

  const boton = pagina.getByRole("button", { name: "Enviar mi denuncia" });
  await boton.waitFor();
  if (LECTURA_MS > 0) await pagina.waitForTimeout(LECTURA_MS);

  try {
    await pagina.evaluate(() => {
      window.__folio.latidos.vigilar = true;
      window.__folio.inicio = performance.now();
    });
    const inicioReloj = performance.now();
    await boton.click();

    // Una interacción real mientras se hace el trabajo: la interfaz debe responder.
    await pagina
      .getByText(/Preparando tu acceso|verificación automática/)
      .first()
      .waitFor({ timeout: 60_000 });
    await pagina.locator("details summary").first().click({ timeout: 30_000 });
    await pagina.keyboard.press("Escape");

    await pagina
      .getByRole("heading", { name: "Tu denuncia se envió" })
      .waitFor({ timeout: 240_000 });
    const totalReloj = performance.now() - inicioReloj;

    const datos = await pagina.evaluate(() => {
      window.__folio.latidos.vigilar = false;
      return {
        inicio: window.__folio.inicio,
        fin: performance.now(),
        etapas: window.__folio.etapas,
        mayorSilencio: window.__folio.latidos.mayor,
        largas: window.__folio.largas,
        eventos: window.__folio.eventos,
      };
    });
    const trabajadores = pagina.workers().map((w) => new URL(w.url()).pathname);
    const etapas = datos.etapas.filter((e) => e.t >= datos.inicio);
    const buscar = (patron) => etapas.find((e) => patron.test(e.texto))?.t ?? null;
    const sellando = buscar(/Sellando/);
    const derivando = buscar(/Preparando tu acceso/);
    const verificando = buscar(/verificación automática/);
    const enviando = buscar(/Enviando tu denuncia/);
    const largasEnvio = datos.largas.filter((l) => l.t >= datos.inicio);
    return {
      totalMs: totalReloj,
      argon2Ms: derivando && verificando ? verificando - derivando : null,
      powMs: verificando && enviando ? enviando - verificando : null,
      sellarMs: sellando && derivando ? derivando - sellando : null,
      envioMs: enviando ? datos.fin - enviando : null,
      contador,
      mayorSilencioMs: datos.mayorSilencio,
      tareaLargaMaxMs: largasEnvio.length ? Math.max(...largasEnvio.map((l) => l.d)) : 0,
      interaccionMaxMs: Math.max(
        0,
        ...datos.eventos.filter((e) => e.t >= datos.inicio).map((e) => e.d),
      ),
      anuncios: etapas.map((e) => e.texto),
      peticionesEnvio,
      trabajadores,
      erroresCsp,
    };
  } finally {
    soltar?.();
    await contexto.close();
  }
};

const mediana = (valores) => {
  const orden = valores.filter((v) => v !== null && v !== undefined).sort((a, b) => a - b);
  return orden.length ? orden[Math.floor((orden.length - 1) / 2)] : null;
};

const navegador = await chromium.launch();
const resultado = {
  fecha: new Date().toISOString(),
  base: BASE,
  calibracion: [],
  corridas: [],
  medianas: [],
};
const guardar = () => writeFileSync(SALIDA, JSON.stringify(resultado, null, 2));

for (const { modo, factor } of MODOS) {
  const c = await calibrar(navegador, modo, factor);
  resultado.calibracion.push({ modo, factor, ...c });
  console.log(
    `calibración ${modo} ${factor}×:`,
    Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v)])),
  );
  guardar();
}

for (const { modo, factor } of MODOS) {
  const corridas = [];
  for (let i = 0; i < REPETICIONES; i += 1) {
    const r = await medirEnvio(navegador, modo, factor);
    corridas.push(r);
    resultado.corridas.push({ modo, factor, ...r });
    console.log(
      `${modo} ${factor}×: total ${r.totalMs.toFixed(0)} ms, Argon2id ${r.argon2Ms?.toFixed(0)} ms, ` +
        `PoW ${r.powMs?.toFixed(0)} ms (contador ${r.contador}), mayor silencio ${r.mayorSilencioMs.toFixed(0)} ms, ` +
        `workers ${r.trabajadores.length}, CSP ${r.erroresCsp.length}`,
    );
    guardar();
  }
  resultado.medianas.push({
    modo,
    factor,
    totalMs: mediana(corridas.map((r) => r.totalMs)),
    argon2Ms: mediana(corridas.map((r) => r.argon2Ms)),
    powMs: mediana(corridas.map((r) => r.powMs)),
    envioMs: mediana(corridas.map((r) => r.envioMs)),
    msPorContador: mediana(corridas.map((r) => (r.contador ? r.powMs / r.contador : null))),
    mayorSilencioMs: mediana(corridas.map((r) => r.mayorSilencioMs)),
    tareaLargaMaxMs: Math.max(...corridas.map((r) => r.tareaLargaMaxMs)),
    interaccionMaxMs: Math.max(...corridas.map((r) => r.interaccionMaxMs)),
    anuncios: corridas[0].anuncios,
    peticionesEnvio: corridas[0].peticionesEnvio,
    trabajadores: corridas[0].trabajadores,
    erroresCsp: corridas.flatMap((r) => r.erroresCsp).length,
  });
  guardar();
}
await navegador.close();
