import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (error) => {
  console.error("[backend] unexpected postgres pool error", error);
});

export const checkDatabase = async (): Promise<void> => {
  await pool.query("SELECT 1");
};

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};
