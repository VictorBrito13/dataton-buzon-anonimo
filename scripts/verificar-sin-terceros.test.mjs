import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { revisarTerceros } from "./verificar-sin-terceros.mjs";

const SCRIPT = fileURLToPath(new URL("./verificar-sin-terceros.mjs", import.meta.url));
const raices = [];

const repoCon = (archivos) => {
  const raiz = mkdtempSync(path.join(tmpdir(), "terceros-"));
  raices.push(raiz);
  for (const [relativo, contenido] of Object.entries(archivos)) {
    const ruta = path.join(raiz, relativo);
    mkdirSync(path.dirname(ruta), { recursive: true });
    writeFileSync(ruta, contenido);
  }
  return raiz;
};

after(() => {
  for (const raiz of raices) rmSync(raiz, { recursive: true, force: true });
});

describe("rechaza", () => {
  const casos = [
    ["CDN jsdelivr", "apps/frontend/dashboard/a.tsx", `const u = "https://cdn.jsdelivr.net/x.js";`],
    ["CDN unpkg", "apps/frontend/dashboard/a.tsx", `const u = "https://unpkg.com/x";`],
    [
      "fuentes de Google",
      "apps/frontend/dashboard/a.css",
      `@import "https://fonts.googleapis.com/x";`,
    ],
    [
      "next/font/google",
      "apps/frontend/dashboard/a.tsx",
      `import { Inter } from "next/font/google";`,
    ],
    ["analítica de Google", "apps/frontend/dashboard/a.tsx", `gtag("event", "x");`],
    ["Plausible", "apps/frontend/dashboard/a.tsx", `const p = "https://plausible.io/js";`],
    ["Sentry", "apps/backend/src/a.ts", `import * as S from "@sentry/node";`],
    [
      "reCAPTCHA",
      "apps/frontend/dashboard/a.tsx",
      `const r = "https://www.google.com/recaptcha/api.js";`,
    ],
    ["script externo", "apps/frontend/dashboard/a.tsx", `<script src="https://ejemplo.mx/a.js" />`],
    [
      "CSS externo",
      "apps/frontend/dashboard/a.css",
      `a { background: url("http://ejemplo.mx/a.png"); }`,
    ],
    ["req.ip", "apps/backend/src/a.ts", `console.log(req.ip);`],
    ["req.ips", "apps/backend/src/a.ts", `const x = req.ips;`],
    ["remoteAddress", "apps/backend/src/a.ts", `const x = req.socket.remoteAddress;`],
    ["user-agent por cabeceras", "apps/backend/src/a.ts", `const x = req.headers["user-agent"];`],
    ["user-agent por get", "apps/backend/src/a.ts", `const x = req.get("User-Agent");`],
    [
      "user-agent en Next",
      "apps/frontend/dashboard/a.ts",
      `const x = headers().get("user-agent");`,
    ],
    ["x-forwarded-for", "apps/backend/src/a.ts", `const x = req.headers["x-forwarded-for"];`],
    ["morgan", "apps/backend/src/a.ts", `import morgan from "morgan";`],
    [
      "dependencia de analítica",
      "apps/frontend/dashboard/package.json",
      `{"dependencies":{"@vercel/analytics":"1"}}`,
    ],
  ];

  for (const [nombre, archivo, codigo] of casos) {
    it(nombre, () => {
      const hallazgos = revisarTerceros(repoCon({ [archivo]: codigo }));
      assert.equal(hallazgos.length, 1, JSON.stringify(hallazgos));
      assert.equal(hallazgos[0].archivo, archivo);
      assert.equal(hallazgos[0].linea, 1);
    });
  }
});

describe("acepta", () => {
  it("rutas propias, enlaces normales y texto parecido", () => {
    const raiz = repoCon({
      "apps/frontend/dashboard/a.tsx": `import Link from "next/link";
export const A = () => <a href="https://github.com/org/repo" rel="noreferrer">repo</a>;
const fetchLocal = () => fetch("/api/v1/configuracion");
const freq = { ip: 1 };`,
      "apps/backend/src/b.ts": `const svg = "http://www.w3.org/2000/svg"; const copia = req.body;`,
    });
    assert.deepEqual(revisarTerceros(raiz), []);
  });

  it("no revisa las pruebas ni carpetas generadas", () => {
    const raiz = repoCon({
      "apps/backend/src/a.test.ts": `const x = req.ip;`,
      "apps/frontend/dashboard/node_modules/z/a.js": `const u = "https://unpkg.com/x";`,
      "apps/frontend/dashboard/.next/a.js": `const u = "https://unpkg.com/x";`,
      "apps/backend/dist/a.js": `const x = req.ip;`,
    });
    assert.deepEqual(revisarTerceros(raiz), []);
  });

  it("no revisa scripts de construcción: no se entregan al navegador", () => {
    const raiz = repoCon({
      "apps/frontend/dashboard/scripts/descargar.mjs": `const u = "https://huggingface.co/m";`,
    });
    assert.deepEqual(revisarTerceros(raiz), []);
  });

  it("sí revisa código que descargue del mismo sitio en tiempo de ejecución", () => {
    const raiz = repoCon({
      "apps/frontend/dashboard/lib/ner.ts": `const u = "https://huggingface.co/m";`,
    });
    assert.equal(revisarTerceros(raiz).length, 1);
  });
});

describe("línea de comandos", () => {
  it("termina con código 1 y nombra el archivo", () => {
    const raiz = repoCon({ "apps/backend/src/a.ts": `log(req.ip);` });
    const r = spawnSync(process.execPath, [SCRIPT, raiz], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /apps\/backend\/src\/a\.ts:1/);
  });

  it("termina con código 0 si está limpio", () => {
    const raiz = repoCon({ "apps/backend/src/a.ts": `export const a = 1;` });
    const r = spawnSync(process.execPath, [SCRIPT, raiz], { encoding: "utf8" });
    assert.equal(r.status, 0);
  });
});
