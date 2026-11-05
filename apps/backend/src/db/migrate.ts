import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { closeDatabase, pool } from "./postgres.js";

/** Aplica en orden los .sql pendientes de migrations/, cada uno en su transacción. */
const DIRECTORIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

export const migrar = async (): Promise<string[]> => {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS migraciones (nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())",
  );
  const { rows } = await pool.query<{ nombre: string }>("SELECT nombre FROM migraciones");
  const aplicadas = new Set(rows.map((r) => r.nombre));
  const archivos = (await readdir(DIRECTORIO)).filter((a) => a.endsWith(".sql")).sort();
  const nuevas: string[] = [];

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = await readFile(path.join(DIRECTORIO, archivo), "utf8");
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query(sql);
      await cliente.query("INSERT INTO migraciones (nombre) VALUES ($1)", [archivo]);
      await cliente.query("COMMIT");
      nuevas.push(archivo);
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw new Error(`Falló la migración ${archivo}`, { cause: error });
    } finally {
      cliente.release();
    }
  }
  return nuevas;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrar()
    .then((nuevas) => console.log(`[migraciones] aplicadas: ${nuevas.join(", ") || "ninguna"}`))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => void closeDatabase());
}
