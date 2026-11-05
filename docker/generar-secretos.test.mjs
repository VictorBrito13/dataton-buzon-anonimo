import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/** Corre el generador contra tres carpetas temporales: secretos, clave y semilla del panel. */
const generar = (entorno = {}, carpetas = {}) => {
  const secretos = carpetas.secretos ?? mkdtempSync(path.join(tmpdir(), "secretos-"));
  const clave = carpetas.clave ?? mkdtempSync(path.join(tmpdir(), "clave-"));
  const semilla = carpetas.semilla ?? mkdtempSync(path.join(tmpdir(), "semilla-"));
  temporales.push(secretos, clave, semilla);
  const r = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env: {
      ...process.env,
      SECRETOS_DIR: secretos,
      CLAVE_AUTORIDAD_DIR: clave,
      SEMILLA_AUTORIDAD_DIR: semilla,
      ...entorno,
    },
  });
  assert.equal(r.status, 0, r.stderr);
  const env = readFileSync(path.join(secretos, "backend.env"), "utf8");
  const semillaEnv = readFileSync(path.join(semilla, "semilla_autoridad.env"), "utf8");
  return { secretos, clave, semilla, env, semillaEnv, salida: r.stdout };
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
  });

  it("la contraseña demo del panel no entra en el entorno del backend", () => {
    const { env, semillaEnv } = generar({ CLAVE_PUBLICA_AUTORIDAD: "" });
    assert.equal(variable(env, "SEMILLA_AUTORIDAD_USUARIO"), undefined);
    assert.equal(variable(env, "SEMILLA_AUTORIDAD_CONTRASENA"), undefined);
    assert.equal(variable(semillaEnv, "SEMILLA_AUTORIDAD_USUARIO"), "autoridad.demo");
    assert.match(variable(semillaEnv, "SEMILLA_AUTORIDAD_CONTRASENA") ?? "", /^[0-9a-f]{32}$/);
    assert.ok(!env.includes(variable(semillaEnv, "SEMILLA_AUTORIDAD_CONTRASENA")));
  });

  it("retira la contraseña demo de un backend.env de una versión anterior y conserva lo demás", () => {
    const secretos = mkdtempSync(path.join(tmpdir(), "secretos-"));
    const previo = [
      "PIMIENTA_ACCESO=aa",
      "SEMILLA_AUTORIDAD_USUARIO=autoridad.demo",
      "SEMILLA_AUTORIDAD_CONTRASENA=0123456789abcdef0123456789abcdef",
      "CLAVE_MENSAJES=bb",
      "",
    ].join("\n");
    writeFileSync(path.join(secretos, "backend.env"), previo);
    const { env, semillaEnv } = generar({ CLAVE_PUBLICA_AUTORIDAD: "" }, { secretos });
    assert.equal(variable(env, "PIMIENTA_ACCESO"), "aa");
    assert.equal(variable(env, "CLAVE_MENSAJES"), "bb");
    assert.ok(!env.includes("SEMILLA_AUTORIDAD"));
    assert.equal(
      variable(semillaEnv, "SEMILLA_AUTORIDAD_CONTRASENA"),
      "0123456789abcdef0123456789abcdef",
      "la contraseña ya sembrada se conserva para que el acceso siga funcionando",
    );
  });

  it("deja el acceso demo del panel junto a la clave, para quien hace la demostración", () => {
    const { semillaEnv, clave } = generar({ CLAVE_PUBLICA_AUTORIDAD: "" });
    const acceso = readFileSync(path.join(clave, "acceso_panel.txt"), "utf8");
    assert.ok(acceso.includes(variable(semillaEnv, "SEMILLA_AUTORIDAD_CONTRASENA")));
  });

  it("es idempotente: una segunda corrida conserva todo", () => {
    const primera = generar({ CLAVE_PUBLICA_AUTORIDAD: "" });
    const segunda = generar(
      { CLAVE_PUBLICA_AUTORIDAD: "" },
      { secretos: primera.secretos, clave: primera.clave, semilla: primera.semilla },
    );
    assert.equal(segunda.env, primera.env);
    assert.equal(segunda.semillaEnv, primera.semillaEnv);
  });
});
