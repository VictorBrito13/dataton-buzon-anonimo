#!/usr/bin/env node
/**
 * Falla si el código introduce terceros (CDN, fuentes remotas, analítica, captchas) o
 * si lee datos que identifican a quien visita (IP, user-agent). Es un filtro simple
 * por patrones; la prueba de fondo es e2e/anonimato, que observa el tráfico real.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAICES = ["apps", "packages"];
const OMITIR_CARPETAS = new Set(["node_modules", ".next", "dist", "out", "coverage", "public"]);
const EXTENSIONES = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|css|html)$/;
const PRUEBA = /\.(test|spec)\.[cm]?[jt]sx?$/;

const PATRONES = [
  {
    motivo: "CDN externo",
    patron:
      /cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|code\.jquery\.com|ajax\.googleapis\.com|cdn\.tailwindcss\.com|stackpath\.bootstrapcdn\.com|esm\.sh|huggingface\.co|\bhf\.co\b/i,
  },
  {
    motivo: "fuente remota",
    patron: /fonts\.googleapis\.com|fonts\.gstatic\.com|next\/font\/google/i,
  },
  {
    motivo: "analítica o rastreo",
    patron:
      /google-analytics\.com|googletagmanager\.com|\bgtag\(|plausible\.io|cdn\.segment\.com|hotjar\.com|clarity\.ms|mixpanel|posthog|matomo|amplitude\.com|fullstory\.com|newrelic|@datadog\/|@sentry\/|sentry\.io|@vercel\/(analytics|speed-insights)|connect\.facebook\.net/i,
  },
  {
    motivo: "captcha de terceros",
    patron:
      /google\.com\/recaptcha|gstatic\.com\/recaptcha|hcaptcha\.com|challenges\.cloudflare\.com/i,
  },
  {
    motivo: "recurso externo",
    patron: /<script[^>]+src=["']https?:|<link[^>]+href=["']https?:|url\(["']?https?:/i,
  },
  {
    motivo: "lectura de IP",
    patron:
      /\b(req|request)\.ips?\b|\.remoteAddress\b|x-forwarded-for|x-real-ip|cf-connecting-ip|true-client-ip/i,
  },
  {
    motivo: "lectura de user-agent",
    patron:
      /(headers(\(\))?(\.get\(|\[)|\.get\(|\.header\()\s*["'`]user-agent["'`]|\buserAgent\s*\(/i,
  },
  { motivo: "bitácora de peticiones", patron: /from\s+["'](morgan|pino-http|express-winston)["']/ },
];

const DEPENDENCIAS_PROHIBIDAS =
  /^(@vercel\/(analytics|speed-insights)|@sentry\/.+|posthog.*|mixpanel.*|morgan|pino-http|express-winston|newrelic|@datadog\/.+|react-ga4?|nextjs-google-analytics|react-google-recaptcha.*|@hcaptcha\/.+)$/;

const listar = (directorio) =>
  readdirSync(directorio).flatMap((nombre) => {
    const ruta = path.join(directorio, nombre);
    if (statSync(ruta).isDirectory()) return OMITIR_CARPETAS.has(nombre) ? [] : listar(ruta);
    return [ruta];
  });

const revisarManifiesto = (texto, archivo) => {
  const lineas = texto.split("\n");
  const manifiesto = JSON.parse(texto);
  const nombres = Object.keys({ ...manifiesto.dependencies, ...manifiesto.devDependencies });
  return nombres
    .filter((nombre) => DEPENDENCIAS_PROHIBIDAS.test(nombre))
    .map((nombre) => ({
      archivo,
      linea: lineas.findIndex((l) => l.includes(`"${nombre}"`)) + 1,
      motivo: `dependencia prohibida: ${nombre}`,
    }));
};

const revisarCodigo = (texto, archivo) =>
  texto.split("\n").flatMap((linea, indice) =>
    PATRONES.filter(({ patron }) => patron.test(linea)).map(({ motivo }) => ({
      archivo,
      linea: indice + 1,
      motivo,
    })),
  );

/** Devuelve { archivo, linea, motivo } por hallazgo, con rutas relativas a `raiz`. */
export const revisarTerceros = (raiz) =>
  RAICES.map((r) => path.join(raiz, r))
    .filter(existsSync)
    .flatMap(listar)
    .flatMap((ruta) => {
      const archivo = path.relative(raiz, ruta).split(path.sep).join("/");
      const nombre = path.basename(ruta);
      if (nombre === "package.json") return revisarManifiesto(readFileSync(ruta, "utf8"), archivo);
      if (!EXTENSIONES.test(nombre) || PRUEBA.test(nombre)) return [];
      return revisarCodigo(readFileSync(ruta, "utf8"), archivo);
    });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hallazgos = revisarTerceros(path.resolve(process.argv[2] ?? "."));
  for (const { archivo, linea, motivo } of hallazgos) {
    console.error(`${archivo}:${linea}: ${motivo}`);
  }
  if (hallazgos.length > 0) {
    console.error(`\n${hallazgos.length} hallazgo(s). Ver D7 en docs/decisiones-arquitectura.md.`);
    process.exit(1);
  }
  console.log("Sin terceros ni lectura de IP o user-agent.");
}
