import { createApp } from "./app.js";
import { registrarError } from "./compartido/infraestructura/registro.js";
import { limpiarHuerfanas } from "./composicion.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/postgres.js";

const INTERVALO_LIMPIEZA_MS = 60 * 60_000;

const server = createApp().listen(env.port, () => {
  console.log(`[backend] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

const limpiar = (): void => {
  limpiarHuerfanas.ejecutar().catch((error: unknown) => {
    registrarError("limpieza de evidencias", error);
  });
};
limpiar();
const limpieza = setInterval(limpiar, INTERVALO_LIMPIEZA_MS);
limpieza.unref();

const finalize = async (error?: Error): Promise<void> => {
  try {
    await closeDatabase();
  } catch (dbError) {
    registrarError("cierre de postgres", dbError);
  }
  if (error) {
    registrarError("cierre del servidor", error);
    process.exit(1);
  }
  process.exit(0);
};

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`[backend] received ${signal}, shutting down`);
  clearInterval(limpieza);
  server.close((error) => {
    void finalize(error);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
