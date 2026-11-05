import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "tablero.spec.ts",
  workers: 2,
  reporter: "list",
  outputDir: "test-results/tablero",
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000" },
});
