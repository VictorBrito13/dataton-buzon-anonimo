import { defineConfig } from "vitest/config";

/**
 * Las pruebas de integración vacían tablas: por eso no usan DATABASE_URL de una
 * máquina de desarrollo. Fuera de CI apuntan al Postgres de pruebas (puerto 5551).
 */
const baseDePruebas =
  process.env.TEST_DATABASE_URL ??
  (process.env.CI ? process.env.DATABASE_URL : undefined) ??
  "postgres://dataton:dataton@localhost:5551/dataton";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: baseDePruebas,
      POW_COSTO: "1",
      POW_CONTADOR_MAX: "5",
      ACCESO_TIEMPO_MINIMO_MS: "60",
      ACCESO_INTENTOS_CREDENCIAL: "8",
      ACCESO_LIMITE_GLOBAL: "100000",
      MAX_BYTES_EVIDENCIA: "2000000",
    },
  },
});
