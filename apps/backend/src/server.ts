import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/postgres.js";

const server = createApp().listen(env.port, () => {
  console.log(`[backend] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

const finalize = async (error?: Error): Promise<void> => {
  try {
    await closeDatabase();
  } catch (dbError) {
    console.error("[backend] error closing postgres pool", dbError);
  }
  if (error) {
    console.error("[backend] error during shutdown", error);
    process.exit(1);
  }
  process.exit(0);
};

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`[backend] received ${signal}, shutting down`);
  server.close((error) => {
    void finalize(error);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
