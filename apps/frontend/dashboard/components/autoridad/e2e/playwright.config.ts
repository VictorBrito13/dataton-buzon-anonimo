import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PUERTO = Number(process.env.PUERTO_PANEL ?? 3217);

/** La API se simula con page.route: estas pruebas no necesitan backend ni base de datos. */
export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  outputDir: process.env.E2E_SALIDA ?? join(tmpdir(), "e2e-panel-autoridad"),
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PUERTO}`, ...devices["Desktop Chrome"] },
  webServer: {
    command: `npx next build && npx next start -p ${PUERTO}`,
    cwd: resolve(__dirname, "../../.."),
    url: `http://localhost:${PUERTO}/autoridad`,
    timeout: 300_000,
    reuseExistingServer: true,
  },
});
