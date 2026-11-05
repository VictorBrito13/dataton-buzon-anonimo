import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** D10: las dependencias apuntan hacia adentro. */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

const archivosDe = (capa: string): string[] =>
  (readdirSync(SRC, { recursive: true }) as string[])
    // Las pruebas junto al código (transparencia) importan vitest: la regla es para el código.
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f.split(path.sep).includes(capa))
    .map((f) => path.join(SRC, f));

const importsDe = (archivo: string): string[] =>
  [...readFileSync(archivo, "utf8").matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1] as string);

describe("arquitectura", () => {
  it("hay archivos en cada capa", () => {
    expect(archivosDe("dominio").length).toBeGreaterThan(5);
    expect(archivosDe("aplicacion").length).toBeGreaterThan(5);
    expect(archivosDe("infraestructura").length).toBeGreaterThan(5);
  });

  it.each(archivosDe("dominio"))("%s solo importa dominio y @dataton/shared", (archivo) => {
    for (const modulo of importsDe(archivo)) {
      expect(modulo).toMatch(/^(@dataton\/shared$|\.\.?\/)/);
      expect(modulo).not.toMatch(/aplicacion|infraestructura|config\/|db\//);
    }
    expect(readFileSync(archivo, "utf8")).not.toContain("process.env");
  });

  it.each(archivosDe("aplicacion"))("%s no depende de infraestructura ni de HTTP", (archivo) => {
    for (const modulo of importsDe(archivo)) {
      expect(modulo).toMatch(/^(@dataton\/shared$|\.\.?\/)/);
      expect(modulo).not.toMatch(/infraestructura|config\/|db\//);
    }
    expect(readFileSync(archivo, "utf8")).not.toContain("process.env");
  });
});
