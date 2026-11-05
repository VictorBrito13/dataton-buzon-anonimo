import type { PoolClient } from "pg";
import { pool } from "../../db/postgres.js";

export const enTransaccion = async <T>(fn: (cliente: PoolClient) => Promise<T>): Promise<T> => {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await fn(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
};
