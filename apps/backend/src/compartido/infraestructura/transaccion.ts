import type { PoolClient } from "pg";
import { pool } from "../../db/postgres.js";

const comoError = (valor: unknown): Error =>
  valor instanceof Error ? valor : new Error(String(valor));

/**
 * Si algo falla se intenta `ROLLBACK`; si hasta eso falla, la conexión puede haber quedado a
 * mitad de una transacción, así que se destruye (`release(error)`) en vez de volver al pool.
 * En ambos casos se propaga el error original.
 */
export const enTransaccion = async <T>(fn: (cliente: PoolClient) => Promise<T>): Promise<T> => {
  const cliente = await pool.connect();
  let descartar: Error | undefined;
  try {
    await cliente.query("BEGIN");
    const resultado = await fn(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    try {
      await cliente.query("ROLLBACK");
    } catch (fallaRollback) {
      descartar = comoError(fallaRollback);
    }
    throw error;
  } finally {
    cliente.release(descartar);
  }
};
