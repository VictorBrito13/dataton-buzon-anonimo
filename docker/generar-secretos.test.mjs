import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./generar-secretos.mjs", import.meta.url));
const temporales = [];

const PUBLICA_EXTERNA = JSON.stringify({
  kty: "EC",
  crv: "P-256",
  x: "4Ce4VQgpxVOK83QXNpWp9aDvR8xbbbLaT7xqguAykvM",
  y: "lLgpqedTMB40bkFVOShb5LCUNRBnt3lk7f0akK1MdzA",
});

/** Corre el generador contra dos carpetas temporales: la de secretos y la de la clave. */
const generar = (entorno = {}) => {
  const secretos = mkdtempSync(path.join(tmpdir(), "secretos-"));
  const clave = mkdtempSync(path.join(tmpdir(), "clave-"));
  temporales.push(secretos, clave);
  const r = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, SECRETOS_DIR: secretos, CLAVE_AUTORIDAD_DIR: clave, ...entorno },
  });
  assert.equal(r.status, 0, r.stderr);
  const env = readFileSync(path.join(secretos, "backend.env"), "utf8");
  return { secretos, clave, env, salida: r.stdout };
};

const variable = (env, nombre) => new RegExp(`^${nombre}=(.*)$`, "m").exec(env)?.[1];

after(() => {
  for (const t of temporales) rmSync(t, { recursive: true, force: true });
});

describe("generar-secretos.mjs", () => {
  it("escribe la clave privada de demostración fuera del volumen de secretos", () => {
    const { secretos, clave } = generar({ CLAVE_PUBLICA_AUTORIDAD: "" });
    assert.ok(!existsSync(path.join(secretos, "autoridad_clave_privada.jwk")));
    const privada = JSON.parse(
      readFileSync(path.join(clave, "autoridad_clave_privada.jwk"), "utf8"),
    );
    assert.equal(privada.kty, "EC");
    assert.equal(privada.crv, "P-256");
    assert.ok(privada.d, "la privada debe traer el parámetro d");
    // Nada en el volumen de secretos contiene la parte privada.
    for (const archivo of readdirSync(secretos)) {
      assert.ok(!readFileSync(path.join(secretos, archivo), "utf8").includes(privada.d));
    }
  });

  it("la pública que recibe el backend corresponde al par generado", () => {
    const { env, clave } = generar({ CLAVE_PUBLICA_AUTORIDAD: "" });
    const privada = JSON.parse(
      readFileSync(path.join(clave, "autoridad_clave_privada.jwk"), "utf8"),
    );
    const publica = JSON.parse(variable(env, "CLAVE_PUBLICA_AUTORIDAD").replace(/^'|'$/g, ""));
    assert.deepEqual(publica, { kty: "EC", crv: "P-256", x: privada.x, y: privada.y });
  });

  it("con CLAVE_PUBLICA_AUTORIDAD dada no genera ninguna clave privada", () => {
    const { env, clave, secretos } = generar({ CLAVE_PUBLICA_AUTORIDAD: PUBLICA_EXTERNA });
    assert.ok(!existsSync(path.join(clave, "autoridad_clave_privada.jwk")));
    assert.ok(!existsSync(path.join(secretos, "autoridad_clave_privada.jwk")));
    assert.equal(variable(env, "CLAVE_PUBLICA_AUTORIDAD"), `'${PUBLICA_EXTERNA}'`);
  });

  it("genera los secretos que el backend exige fuera de desarrollo y el acceso demo del panel", () => {
    const { env } = generar({ CLAVE_PUBLICA_AUTORIDAD: "" });
    for (const nombre of ["PIMIENTA_ACCESO", "ALTCHA_CLAVE_HMAC", "CLAVE_MENSAJES"]) {
      assert.match(variable(env, nombre) ?? "", /^[0-9a-f]{64}$/, nombre);
    }
    assert.match(
      variable(env, "DATABASE_URL") ?? "",
      /^postgres:\/\/dataton:[0-9a-f]{64}@db:5432\/dataton$/,
    );
    assert.match(
      variable(env, "DATABASE_URL_PUBLICO") ?? "",
      /^postgres:\/\/buzon_lector_publico:/,
    );
    assert.equal(variable(env, "SEMILLA_AUTORIDAD_USUARIO"), "autoridad.demo");
    assert.match(variable(env, "SEMILLA_AUTORIDAD_CONTRASENA") ?? "", /^[0-9a-f]{32}$/);
  });

  it("deja el acceso demo del panel junto a la clave, para quien hace la demostración", () => {
    const { env, clave } = generar({ CLAVE_PUBLICA_AUTORIDAD: "" });
    const acceso = readFileSync(path.join(clave, "acceso_panel.txt"), "utf8");
    assert.ok(acceso.includes(variable(env, "SEMILLA_AUTORIDAD_CONTRASENA")));
  });

  it("es idempotente: una segunda corrida conserva todo", () => {
    const primera = generar({ CLAVE_PUBLICA_AUTORIDAD: "" });
    const r = spawnSync(process.execPath, [SCRIPT], {
      encoding: "utf8",
      env: {
        ...process.env,
        SECRETOS_DIR: primera.secretos,
        CLAVE_AUTORIDAD_DIR: primera.clave,
        CLAVE_PUBLICA_AUTORIDAD: "",
      },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readFileSync(path.join(primera.secretos, "backend.env"), "utf8"), primera.env);
  });
});
