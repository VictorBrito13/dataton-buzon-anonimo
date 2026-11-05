import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { entornoCon } from "./con-entorno.mjs";

const SCRIPT = fileURLToPath(new URL("./con-entorno.mjs", import.meta.url));

/** Lanza el script con un comando que imprime NODE_ENV, como lo haría un script npm. */
const correr = (entorno, ...argumentos) =>
  spawnSync(
    process.execPath,
    [SCRIPT, ...argumentos, process.execPath, "-p", "process.env.NODE_ENV ?? 'sin definir'"],
    { encoding: "utf8", env: entorno },
  );

describe("entornoCon", () => {
  it("fija development cuando NODE_ENV no existe", () => {
    assert.equal(entornoCon({ PATH: "x" }).NODE_ENV, "development");
  });

  it("respeta un NODE_ENV explícito, incluido production", () => {
    assert.equal(entornoCon({ NODE_ENV: "production" }).NODE_ENV, "production");
    assert.equal(entornoCon({ NODE_ENV: "test" }).NODE_ENV, "test");
  });

  it("trata una cadena vacía como ausente, igual que ${NODE_ENV:-development}", () => {
    assert.equal(entornoCon({ NODE_ENV: "" }).NODE_ENV, "development");
  });

  it("no toca el resto del entorno", () => {
    assert.equal(entornoCon({ OTRA: "valor" }).OTRA, "valor");
  });
});

describe("con-entorno.mjs como lanzador", () => {
  const base = { PATH: process.env.PATH ?? "", Path: process.env.Path ?? "" };

  it("lanza el comando con development por defecto", () => {
    const r = correr(base);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "development");
  });

  it("conserva el valor que trae el entorno", () => {
    const r = correr({ ...base, NODE_ENV: "production" });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), "production");
  });

  it("propaga el código de salida del comando", () => {
    const r = spawnSync(process.execPath, [SCRIPT, process.execPath, "-e", "process.exit(7)"], {
      encoding: "utf8",
      env: base,
    });
    assert.equal(r.status, 7);
  });

  it("falla con un mensaje si no recibe comando", () => {
    const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env: base });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Uso:/);
  });
});
