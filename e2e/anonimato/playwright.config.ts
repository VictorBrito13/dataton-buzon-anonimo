import { defineConfig, devices } from "@playwright/test";
import { URL_BASE } from "./apoyo";

/**
 * Corre contra el despliegue real de docker-compose.yml, no contra un servidor de desarrollo:
 * lo que se demuestra es lo que un tercero puede levantar. Ver docs/guia-de-replica.md.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../../test-results/anonimato",
  // Las pruebas detienen servicios y leen bitácoras del mismo despliegue.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  timeout: 90_000,
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  reporter: [["list"], ["./reporte.ts"]],
  use: {
    baseURL: URL_BASE,
    // `tls internal` emite un certificado local en el que el navegador de pruebas no confía.
    ignoreHTTPSErrors: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
