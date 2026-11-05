import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { revisarArquitectura } from "./verificar-arquitectura.mjs";

const SCRIPT = fileURLToPath(new URL("./verificar-arquitectura.mjs", import.meta.url));
const raices = [];

/** Crea un repositorio mínimo con los archivos dados, relativos a contextos/. */
const repoCon = (archivos) => {
  const raiz = mkdtempSync(path.join(tmpdir(), "arquitectura-"));
  raices.push(raiz);
  for (const [relativo, contenido] of Object.entries(archivos)) {
    const ruta = path.join(raiz, "apps/backend/src/contextos", relativo);
    mkdirSync(path.dirname(ruta), { recursive: true });
    writeFileSync(ruta, contenido);
  }
  return raiz;
};

const reglasDe = (raiz) => revisarArquitectura(raiz).map((v) => v.regla);

after(() => {
  for (const raiz of raices) rmSync(raiz, { recursive: true, force: true });
});

describe("dominio", () => {
  const casos = [
    ["express", `import express from "express";`],
    ["pg", `import { Pool } from "pg";`],
    ["env", `import { env } from "../../../config/env.js";`],
    ["infraestructura", `import { repo } from "../infraestructura/repo.js";`],
    ["infraestructura de otro contexto", `export { x } from "../../otro/infraestructura/x.js";`],
    ["importación dinámica", `export const c = () => import("pg");`],
    ["require", `const pg = require("pg"); export default pg;`],
    ["aplicacion", `import { caso } from "../aplicacion/caso.js";`],
    ["process.env", `export const k = process.env.UMBRAL_K;`],
  ];

  for (const [nombre, codigo] of casos) {
    it(`rechaza ${nombre}`, () => {
      const raiz = repoCon({ "denuncias/dominio/folio.ts": codigo });
      assert.equal(reglasDe(raiz).length, 1, nombre);
    });
  }

  it("revisa subcarpetas y archivos tsx", () => {
    const raiz = repoCon({ "tramite/dominio/a/b/etapa.tsx": `import "express";` });
    assert.equal(reglasDe(raiz).length, 1);
  });

  it("acepta dependencias internas del dominio y @dataton/shared", () => {
    const raiz = repoCon({
      "denuncias/dominio/folio.ts": `import { z } from "zod";
import { esquemaFolio } from "@dataton/shared";
import { otra } from "./otra.js";
export const f = [z, esquemaFolio, otra];`,
    });
    assert.deepEqual(reglasDe(raiz), []);
  });

  it("no se confunde con comentarios ni con nombres parecidos", () => {
    const raiz = repoCon({
      "denuncias/dominio/folio.ts": `// import express from "express";
import { environ } from "./environment.js";
import { pgp } from "./pgp.js";
export const nota = "process.env no se usa aquí";
export const u = [environ, pgp];`,
    });
    assert.deepEqual(reglasDe(raiz), []);
  });
});

describe("aplicacion", () => {
  it("rechaza importar infraestructura", () => {
    const raiz = repoCon({
      "denuncias/aplicacion/crear.ts": `import { repo } from "../infraestructura/repo.js";`,
    });
    assert.equal(reglasDe(raiz).length, 1);
  });

  it("acepta importar dominio", () => {
    const raiz = repoCon({
      "denuncias/aplicacion/crear.ts": `import { folio } from "../dominio/folio.js";`,
    });
    assert.deepEqual(reglasDe(raiz), []);
  });
});

describe("infraestructura y repositorio sin contextos", () => {
  it("infraestructura puede usar express, pg y las capas interiores", () => {
    const raiz = repoCon({
      "denuncias/infraestructura/rutas.ts": `import express from "express";
import { Pool } from "pg";
import { crear } from "../aplicacion/crear.js";
export const r = [express, Pool, crear];`,
    });
    assert.deepEqual(reglasDe(raiz), []);
  });

  it("un repositorio sin contextos no tiene violaciones", () => {
    const raiz = mkdtempSync(path.join(tmpdir(), "arquitectura-"));
    raices.push(raiz);
    assert.deepEqual(revisarArquitectura(raiz), []);
  });
});

describe("línea de comandos", () => {
  it("termina con código 1 y nombra el archivo si hay una violación", () => {
    const raiz = repoCon({ "denuncias/dominio/folio.ts": `import express from "express";` });
    const r = spawnSync(process.execPath, [SCRIPT, raiz], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /denuncias\/dominio\/folio\.ts/);
  });

  it("termina con código 0 si está limpio", () => {
    const raiz = repoCon({ "denuncias/dominio/folio.ts": `export const a = 1;` });
    const r = spawnSync(process.execPath, [SCRIPT, raiz], { encoding: "utf8" });
    assert.equal(r.status, 0);
  });
});
