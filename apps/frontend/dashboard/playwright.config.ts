import { defineConfig } from "@playwright/test";

const PUERTO_APP = Number(process.env.PUERTO_APP ?? 3100);
const PUERTO_API = Number(process.env.PUERTO_SIMULADO ?? 4100);

/** Corre contra `next build && next start`: la CSP de producción debe estar activa. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PUERTO_APP}`,
    trace: "off",
  },
  projects: [
    { name: "celular", use: { browserName: "chromium", viewport: { width: 390, height: 844 } } },
    { name: "escritorio", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: "node e2e/servidor-simulado.mjs",
      port: PUERTO_API,
      env: { PUERTO_SIMULADO: String(PUERTO_API) },
      reuseExistingServer: true,
    },
    {
      command: `npx next build && npx next start -p ${PUERTO_APP}`,
      port: PUERTO_APP,
      env: { API_INTERNA: `http://localhost:${PUERTO_API}` },
      timeout: 240_000,
      reuseExistingServer: true,
    },
  ],
});
