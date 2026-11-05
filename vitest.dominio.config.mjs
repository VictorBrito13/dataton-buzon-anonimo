import { defineConfig } from "vitest/config";

/**
 * Barrera de cobertura de la capa de dominio (D10). Las reglas de negocio nacen de una prueba,
 * así que el dominio debe quedar casi completo; infraestructura y aplicación no cuentan aquí.
 */
export default defineConfig({
  test: {
    include: [
      "apps/backend/src/**/dominio/**/*.test.ts",
      "apps/backend/test/**/dominio*.test.ts",
      "apps/backend/test/**/dominio/**/*.test.ts",
    ],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      reportsDirectory: "coverage/dominio",
      include: ["apps/backend/src/**/dominio/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 80 },
    },
  },
});
