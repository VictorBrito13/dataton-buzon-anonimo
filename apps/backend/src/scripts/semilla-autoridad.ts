import "dotenv/config";
import { closeDatabase, pool } from "../db/postgres.js";
import { hashSecret } from "../security/argon2.js";

/** Crea o actualiza el usuario demo del panel, con datos que vienen solo del entorno. */
const usuario = process.env.SEMILLA_AUTORIDAD_USUARIO;
const contrasena = process.env.SEMILLA_AUTORIDAD_CONTRASENA;

try {
  if (!usuario || !contrasena) {
    throw new Error("Define SEMILLA_AUTORIDAD_USUARIO y SEMILLA_AUTORIDAD_CONTRASENA");
  }
  await pool.query(
    `INSERT INTO autoridad_usuarios (usuario, contrasena_hash) VALUES ($1, $2)
     ON CONFLICT (usuario) DO UPDATE SET contrasena_hash = EXCLUDED.contrasena_hash`,
    [usuario, await hashSecret(contrasena)],
  );
  console.log(`[semilla] usuario listo: ${usuario}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falló la semilla");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
