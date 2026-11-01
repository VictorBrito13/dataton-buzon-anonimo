import { createApp } from "./app.js";
import { env } from "./config/env.js";

const server = createApp().listen(env.port, () => {
  console.log(`[backend] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

const shutdown = (signal: NodeJS.Signals): void => {
  console.log(`[backend] received ${signal}, shutting down`);
  server.close((error) => {
    if (error) {
      console.error("[backend] error during shutdown", error);
      process.exit(1);
    }
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
