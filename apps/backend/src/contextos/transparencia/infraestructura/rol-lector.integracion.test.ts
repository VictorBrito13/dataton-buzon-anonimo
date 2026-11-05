import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearLecturaAgregados } from "./repositorios-postgres.js";

/**
 * D6, regla 7. Requiere Postgres con las migraciones aplicadas:
 * TEST_DATABASE_URL=postgres://dataton:dataton@localhost:5552/dataton npm test
 */
const URL_ADMIN = process.env.TEST_DATABASE_URL;

const CODIGO_SIN_PERMISOS = "42501";

describe.skipIf(!URL_ADMIN)("rol de solo lectura de la API pública", () => {
  let lector: pg.Pool;

  beforeAll(() => {
    const url = new URL(URL_ADMIN ?? "");
    url.username = "buzon_lector_publico";
    url.password = "lector_publico_solo_desarrollo";
    lector = new pg.Pool({ connectionString: url.toString(), max: 1 });
  });
  afterAll(async () => {
    await lector.end();
  });

  it("puede leer agregados_publicos", async () => {
    await expect(crearLecturaAgregados(lector).listarPeriodos()).resolves.toBeInstanceOf(Array);
  });

  it.each([
    "denuncias",
    "denuncia_etapas",
    "evidencias",
    "mensajes",
    "autoridad_usuarios",
    "bitacora_autoridad",
  ])("recibe error de permisos al leer %s", async (tabla) => {
    await expect(lector.query(`SELECT * FROM ${tabla} LIMIT 1`)).rejects.toMatchObject({
      code: CODIGO_SIN_PERMISOS,
    });
  });

  it("no puede escribir en agregados_publicos", async () => {
    await expect(
      lector.query("DELETE FROM agregados_publicos WHERE periodo = 'x'"),
    ).rejects.toMatchObject({ code: CODIGO_SIN_PERMISOS });
  });

  it("no puede crear tablas", async () => {
    await expect(lector.query("CREATE TABLE intruso (id int)")).rejects.toMatchObject({
      code: CODIGO_SIN_PERMISOS,
    });
  });
});
