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
const VOLUMEN_SEMILLA = "semilla-autoridad-demo";
/** Solo estos pueden ver la clave privada de demostración; ninguno sirve tráfico ni queda encendido. */
const PUEDEN_VER_LA_CLAVE = new Set(["secretos", "clave-autoridad"]);
/** La contraseña demo del panel: la escribe `secretos` y solo la lee quien siembra el usuario. */
const PUEDEN_VER_LA_SEMILLA = new Set(["secretos", "migraciones"]);
const SERVICIOS_EN_EJECUCION = ["backend", "frontend", "db", "caddy"];

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

describe("docker-compose.yml y la contraseña demo del panel", () => {
  it("declara un volumen propio para la semilla del usuario demo", () => {
    assert.ok(config.volumes[VOLUMEN_SEMILLA], `falta el volumen ${VOLUMEN_SEMILLA}`);
  });

  it("solo la escribe `secretos` y solo la lee `migraciones`, en modo lectura", () => {
    const culpables = Object.entries(config.services)
      .filter(([nombre]) => !PUEDEN_VER_LA_SEMILLA.has(nombre))
      .filter(([, servicio]) => montajesDe(servicio).includes(VOLUMEN_SEMILLA))
      .map(([nombre]) => nombre);
    assert.deepEqual(culpables, []);
    for (const nombre of PUEDEN_VER_LA_SEMILLA) {
      assert.ok(montajesDe(config.services[nombre]).includes(VOLUMEN_SEMILLA), nombre);
    }
    const montaje = config.services.migraciones.volumes.find((v) => v.source === VOLUMEN_SEMILLA);
    assert.equal(montaje.read_only, true);
    // El generador recibe la ruta por entorno y no la deduce: así la prueba y el script coinciden.
    const destino = config.services.secretos.volumes.find((v) => v.source === VOLUMEN_SEMILLA);
    assert.equal(config.services.secretos.environment.SEMILLA_AUTORIDAD_DIR, destino.target);
  });

  for (const nombre of SERVICIOS_EN_EJECUCION) {
    it(`${nombre} no monta la semilla ni recibe la contraseña por entorno`, () => {
      const servicio = config.services[nombre];
      assert.ok(!montajesDe(servicio).includes(VOLUMEN_SEMILLA));
      for (const variable of Object.keys(servicio.environment ?? {})) {
        assert.ok(!variable.startsWith("SEMILLA_AUTORIDAD"), variable);
      }
    });
  }
});

describe("docker-compose.yml y los datos de demostración", () => {
  it("el generador sintético solo arranca a mano, con la misma imagen del backend", () => {
    const sintetico = config.services.sintetico;
    assert.ok(sintetico, "falta el servicio sintetico");
    assert.ok(
      (sintetico.profiles ?? []).length > 0,
      "sin perfil arrancaría con `docker compose up`",
    );
    assert.equal(sintetico.image, config.services.backend.image);
    assert.equal(sintetico.restart, "no");
    assert.equal(sintetico.ports, undefined);
  });

  it("declara la bandera de demostración: sin ella el generador se niega en producción", () => {
    const { environment } = config.services.sintetico;
    assert.equal(environment.NODE_ENV, "production");
    assert.equal(environment.DATOS_SINTETICOS_DEMO, "1");
  });

  it("ningún servicio en ejecución lleva la bandera de demostración", () => {
    for (const nombre of [...SERVICIOS_EN_EJECUCION, "migraciones"]) {
      const { environment } = config.services[nombre];
      assert.equal(environment?.DATOS_SINTETICOS_DEMO, undefined, nombre);
    }
  });

  it("no monta la clave privada ni la semilla del panel", () => {
    const montajes = montajesDe(config.services.sintetico);
    assert.ok(!montajes.includes(VOLUMEN_CLAVE));
    assert.ok(!montajes.includes(VOLUMEN_SEMILLA));
  });
});
