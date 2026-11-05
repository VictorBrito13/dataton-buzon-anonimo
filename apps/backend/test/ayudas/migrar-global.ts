/**
 * globalSetup de vitest: corre en el proceso principal, donde `test.env` no aplica, por eso fija
 * aquí el entorno antes de cargar `env.ts`. Deja la base de pruebas migrada para todos los archivos.
 */
export default async function migrarBaseDePruebas(): Promise<void> {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    (process.env.CI ? process.env.DATABASE_URL : undefined) ??
    "postgres://dataton:dataton@localhost:5551/dataton";
  const { migrar } = await import("../../src/db/migrate.js");
  const { closeDatabase } = await import("../../src/db/postgres.js");
  try {
    await migrar();
  } finally {
    await closeDatabase();
  }
}
