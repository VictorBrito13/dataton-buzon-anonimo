import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import type { BrowserContext, Page, Request } from "@playwright/test";

export const RAIZ = path.resolve(__dirname, "../..");

export const PROYECTO = process.env.ANONIMATO_PROYECTO ?? "dataton-infra";
export const PUERTO_HTTP = process.env.ANONIMATO_PUERTO_HTTP ?? "18080";
export const PUERTO_HTTPS = process.env.ANONIMATO_PUERTO_HTTPS ?? "18443";
export const URL_BASE = `https://localhost:${PUERTO_HTTPS}`;
export const URL_HTTP = `http://localhost:${PUERTO_HTTP}`;

/** Con 1 se prueba un despliegue ya levantado y no se apaga al terminar. */
export const USAR_DESPLIEGUE_EXISTENTE = process.env.ANONIMATO_DESPLIEGUE_EXISTENTE === "1";

/** Con 1, un flujo ausente es una falla, no un `fixme`. Se activa al integrar los frentes. */
export const EXIGIR_FLUJO = process.env.ANONIMATO_EXIGIR_FLUJO === "1";

export const PAGINAS_PUBLICAS = [
  "/",
  "/como-te-protegemos",
  "/denunciar",
  "/seguimiento",
  "/tablero",
] as const;

/** 203.0.113.0/24 es un rango reservado para documentación: nunca es una IP real. */
export const IP_MARCADOR = "203.0.113.77";
export const UA_MARCADOR = "NavegadorMarcador/9.9 (prueba-anonimato-7f3a)";
export const RELATO_MARCADOR = "MARCADOR_RELATO_7F3A";
export const CABECERAS_MARCADOR = {
  "X-Forwarded-For": IP_MARCADOR,
  "X-Real-IP": IP_MARCADOR,
  Forwarded: `for=${IP_MARCADOR}`,
};
export const OPCIONES_CONTEXTO_MARCADO = {
  userAgent: UA_MARCADOR,
  extraHTTPHeaders: CABECERAS_MARCADOR,
};

export const docker = (argumentos: string[]): string =>
  execFileSync("docker", argumentos, { cwd: RAIZ, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

/** Salida estándar y de errores de un contenedor: Caddy escribe sus registros en la segunda. */
export const bitacoraDeContenedor = (nombre: string): string => {
  const { stdout, stderr } = spawnSync("docker", ["logs", nombre], { encoding: "utf8" });
  return stdout + stderr;
};

export const compose = (argumentos: string[], opciones: { salidaVisible?: boolean } = {}): string =>
  execFileSync("docker", ["compose", "-p", PROYECTO, ...argumentos], {
    cwd: RAIZ,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: opciones.salidaVisible ? "inherit" : ["ignore", "pipe", "pipe"],
    env: { ...process.env, PUERTO_HTTP, PUERTO_HTTPS },
  }) ?? "";

/** Bitácoras de todos los servicios, incluidas las de contenedores ya terminados. */
export const leerBitacoras = (): string =>
  compose([
    "logs",
    "--no-color",
    "--no-log-prefix",
    "db",
    "backend",
    "frontend",
    "caddy",
    "migraciones",
  ]);

export const volcarBaseDeDatos = (): string =>
  compose(["exec", "-T", "db", "pg_dump", "-U", "dataton", "--inserts", "dataton"]);

export const consultarBaseDeDatos = (sql: string): string =>
  compose(["exec", "-T", "db", "psql", "-U", "dataton", "-d", "dataton", "-c", sql]);

/** IP con la que el anfitrión llega a Caddy: la "IP real" de quien visita en esta prueba. */
export const ipDelAnfitrion = (): string =>
  docker([
    "network",
    "inspect",
    `${PROYECTO}_publica`,
    "--format",
    "{{(index .IPAM.Config 0).Gateway}}",
  ]).trim();

/** Formas en que un texto puede aparecer: en claro, escapado o codificado. */
export const variantes = (texto: string): Buffer[] => {
  const utf8 = Buffer.from(texto, "utf8");
  return [
    texto,
    texto.toLowerCase(),
    encodeURIComponent(texto),
    encodeURIComponent(texto).replaceAll("%20", "+"),
    JSON.stringify(texto).slice(1, -1),
    utf8.toString("base64").replace(/=+$/, ""),
    utf8.toString("base64url"),
    utf8.toString("hex"),
  ].map((v) => Buffer.from(v, "utf8"));
};

/** Devuelve los secretos que aparecen en `contenido`, en cualquiera de sus variantes. */
export const secretosPresentes = (
  contenido: Buffer | string,
  secretos: Record<string, string>,
): string[] => {
  const datos = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido, "utf8");
  return Object.entries(secretos)
    .filter(([, valor]) => variantes(valor).some((v) => datos.includes(v)))
    .map(([nombre]) => nombre);
};

/** `allHeaders` puede no resolverse nunca si la petición se cancela; hay que acotar la espera. */
const cabecerasCompletas = (peticion: Request): Promise<Record<string, string>> =>
  Promise.race([
    peticion.allHeaders().catch(() => peticion.headers()),
    new Promise<Record<string, string>>((resolver) => {
      setTimeout(() => resolver(peticion.headers()), 3_000);
    }),
  ]);

export interface PeticionGrabada {
  metodo: string;
  url: string;
  cabeceras: string;
  cuerpo: Buffer;
}

/** Registra todo lo que sale del navegador: peticiones, trabajadores y WebSockets. */
export class Grabadora {
  readonly peticiones: PeticionGrabada[] = [];
  private pendientes: Promise<void>[] = [];

  constructor(contexto: BrowserContext) {
    contexto.on("request", (peticion) => {
      this.pendientes.push(
        cabecerasCompletas(peticion).then((cabeceras) => {
          this.peticiones.push({
            metodo: peticion.method(),
            url: peticion.url(),
            cabeceras: JSON.stringify(cabeceras),
            cuerpo: peticion.postDataBuffer() ?? Buffer.alloc(0),
          });
        }),
      );
    });
    const vigilar = (pagina: Page) =>
      pagina.on("websocket", (ws) => {
        ws.on("framesent", ({ payload }) => {
          this.peticiones.push({
            metodo: "WS",
            url: ws.url(),
            cabeceras: "",
            cuerpo: Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8"),
          });
        });
      });
    contexto.pages().forEach(vigilar);
    contexto.on("page", vigilar);
  }

  async listas(): Promise<PeticionGrabada[]> {
    await Promise.all(this.pendientes);
    return this.peticiones;
  }
}

/** URLs fuera del origen propio. `data:` y `blob:` no salen a la red. */
export const dominiosAjenos = (peticiones: PeticionGrabada[], origen: string): string[] => {
  const propio = new URL(origen).host;
  return [
    ...new Set(
      peticiones
        .map((p) => new URL(p.url))
        .filter((u) => !["data:", "blob:"].includes(u.protocol) && u.host !== propio)
        .map((u) => u.href),
    ),
  ];
};

/** Lo que la pestaña dejó guardado en el dispositivo. Sin borrador, debe estar vacío. */
export const almacenamientoDe = (pagina: Page) =>
  pagina.evaluate(async () => ({
    localStorage: Object.keys(localStorage),
    sessionStorage: Object.keys(sessionStorage),
    indexedDB: (await indexedDB.databases()).map((d) => d.name ?? ""),
    cacheStorage: await caches.keys(),
  }));

export const ALMACENAMIENTO_VACIO = {
  localStorage: [],
  sessionStorage: [],
  indexedDB: [],
  cacheStorage: [],
};

export interface ResultadoFlujo {
  frase: string;
  folio: string;
  relato: string;
}

/**
 * Carga una página y da tiempo a las peticiones tardías, como las precargas de enlaces. No se usa
 * `networkidle`: Next deja abiertas las precargas que responden 404 y nunca se alcanzaría.
 */
export const visitar = async (pagina: Page, ruta: string) => {
  const respuesta = await pagina.goto(ruta, { waitUntil: "load" });
  await pagina.waitForTimeout(2_000);
  return respuesta;
};

/** ¿Existe ya el formulario? Sirve para marcar `fixme` en lugar de pasar sin probar nada. */
export const flujoDisponible = async (pagina: Page): Promise<boolean> => {
  const respuesta = await visitar(pagina, "/denunciar");
  if (!respuesta || respuesta.status() >= 400) return false;
  return (await pagina.getByTestId("denuncia-formulario").count()) > 0;
};

/**
 * Recorre el formulario sin suponer el orden de los pasos: llena lo que esté visible y avanza.
 * No activa el borrador. Contrato de `data-testid`: docs/modelo-de-amenazas.md, sección 6.
 */
export const completarDenuncia = async (pagina: Page): Promise<ResultadoFlujo> => {
  const relato = `Relato sintético de prueba, no es un hecho real. ${RELATO_MARCADOR}.`;
  const folio = pagina.getByTestId("folio-denuncia");
  const fraseVisible = pagina.getByTestId("frase-recuperacion");
  let frase = "";

  for (let paso = 0; paso < 15; paso += 1) {
    if (await folio.isVisible()) break;
    if (await fraseVisible.isVisible()) frase = ((await fraseVisible.textContent()) ?? "").trim();

    const campoRelato = pagina.getByTestId("denuncia-relato");
    if ((await campoRelato.isVisible()) && !(await campoRelato.inputValue())) {
      await campoRelato.fill(relato);
    }
    for (const lista of await pagina.locator("select:visible").all()) {
      if (!(await lista.inputValue())) await lista.selectOption({ index: 1 });
    }
    const confirmar = pagina.getByTestId("frase-confirmar");
    if ((await confirmar.isVisible()) && !(await confirmar.isChecked())) await confirmar.check();

    const enviar = pagina.getByTestId("denuncia-enviar");
    const avanzar = (await enviar.isVisible()) ? enviar : pagina.getByTestId("denuncia-siguiente");
    await avanzar.click();
    await pagina.waitForTimeout(250);
  }

  // La prueba de trabajo y Argon2id tardan: el folio llega cuando terminan.
  await folio.waitFor({ state: "visible", timeout: 60_000 });
  if (await fraseVisible.isVisible()) frase = ((await fraseVisible.textContent()) ?? "").trim();
  return { frase, folio: ((await folio.textContent()) ?? "").trim(), relato };
};
