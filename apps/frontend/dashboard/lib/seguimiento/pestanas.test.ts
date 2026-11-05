import { describe, expect, it } from "vitest";
import { pestanaPorTecla } from "./pestanas";

describe("pestanaPorTecla", () => {
  const lista = ["folio", "frase"] as const;

  it("las flechas recorren en círculo", () => {
    expect(pestanaPorTecla(lista, "folio", "ArrowRight")).toBe("frase");
    expect(pestanaPorTecla(lista, "frase", "ArrowRight")).toBe("folio");
    expect(pestanaPorTecla(lista, "folio", "ArrowLeft")).toBe("frase");
  });

  it("Inicio y Fin van a los extremos y otras teclas no hacen nada", () => {
    expect(pestanaPorTecla(lista, "frase", "Home")).toBe("folio");
    expect(pestanaPorTecla(lista, "folio", "End")).toBe("frase");
    expect(pestanaPorTecla(lista, "folio", "a")).toBeNull();
  });
});
