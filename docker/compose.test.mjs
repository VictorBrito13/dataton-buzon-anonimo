import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * D3: el servidor no puede abrir relatos. La clave privada de demostración vive en su propio
 * volumen y ningún servicio que sirva tráfico, ni la base, ni las migraciones, lo montan.
 * Lee la configuración resuelta por `docker compose config`, no el YAML a mano.
 */
const RAIZ = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const VOLUMEN_CLAVE = "clave-autoridad-demo";
const VOLUMEN_SECRETOS = "secretos";
/** Solo estos pueden ver la clave privada de demostración; ninguno sirve tráfico ni queda encendido. */
const PUEDEN_VER_LA_CLAVE = new Set(["secretos", "clave-autoridad"]);

let config;

const montajesDe = (servicio) =>
  (servicio.volumes ?? []).map((v) => (typeof v === "string" ? v.split(":")[0] : v.source));

before(() => {
  const r = spawnSync("docker", ["compose", "--profile", "*", "config", "--format", "json"], {
    cwd: RAIZ,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.equal(r.status, 0, r.stderr);
  config = JSON.parse(r.stdout);
});

describe("docker-compose.yml y la clave privada de la autoridad", () => {
  it("declara un volumen propio para la clave de demostración", () => {
    assert.ok(config.volumes[VOLUMEN_CLAVE], `falta el volumen ${VOLUMEN_CLAVE}`);
  });

  it("ningún servicio de larga duración monta ese volumen", () => {
    const culpables = Object.entries(config.services)
      .filter(([nombre]) => !PUEDEN_VER_LA_CLAVE.has(nombre))
      .filter(([, servicio]) => montajesDe(servicio).includes(VOLUMEN_CLAVE))
      .map(([nombre]) => nombre);
    assert.deepEqual(culpables, []);
  });

  for (const nombre of ["backend", "frontend", "db", "caddy", "migraciones"]) {
    it(`${nombre} existe y no puede leer la clave privada`, () => {
      const servicio = config.services[nombre];
      assert.ok(servicio, `no existe el servicio ${nombre}`);
      assert.ok(!montajesDe(servicio).includes(VOLUMEN_CLAVE));
    });
  }

  it("la clave privada no se escribe en el volumen que monta el backend", () => {
    const secretos = config.services.secretos;
    const destinos = (secretos.volumes ?? []).map((v) => `${v.source}:${v.target}`);
    assert.ok(destinos.some((d) => d.startsWith(`${VOLUMEN_SECRETOS}:`)));
    assert.ok(destinos.some((d) => d.startsWith(`${VOLUMEN_CLAVE}:`)));
    const ruta = destinos.find((d) => d.startsWith(`${VOLUMEN_CLAVE}:`)).split(":")[1];
    // El generador recibe la ruta por entorno y no la deduce: así la prueba y el script coinciden.
    assert.equal(secretos.environment.CLAVE_AUTORIDAD_DIR, ruta);
  });

  it("los que ven la clave no tienen red, no se reinician y no sirven tráfico", () => {
    for (const nombre of PUEDEN_VER_LA_CLAVE) {
      const servicio = config.services[nombre];
      assert.ok(servicio, `no existe el servicio ${nombre}`);
      assert.equal(servicio.network_mode, "none", `${nombre} debe ir sin red`);
      assert.equal(servicio.restart, "no", `${nombre} no debe reiniciarse`);
      assert.equal(servicio.ports, undefined, `${nombre} no debe publicar puertos`);
    }
  });

  it("el lector de la clave solo arranca a mano: tiene perfil y solo monta ese volumen en lectura", () => {
    const lector = config.services["clave-autoridad"];
    assert.ok((lector.profiles ?? []).length > 0, "sin perfil arrancaría con `docker compose up`");
    assert.deepEqual(montajesDe(lector), [VOLUMEN_CLAVE]);
    assert.ok(lector.volumes.every((v) => v.read_only === true));
  });
});
