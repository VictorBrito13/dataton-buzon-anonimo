import { describe, expect, it } from "vitest";
import { PASOS, anuncioPaso, numeroPaso, pasoAnterior, pasoSiguiente } from "./pasos";

describe("pasos del asistente", () => {
  it("sigue el orden hechos, personas, evidencias, revisión, frase y envío", () => {
    expect(PASOS.map((p) => p.clave)).toEqual([
      "hechos",
      "personas",
      "evidencias",
      "revision",
      "frase",
      "envio",
    ]);
  });

  it("avanza y retrocede sin salirse de los extremos", () => {
    expect(pasoSiguiente("hechos")).toBe("personas");
    expect(pasoSiguiente("envio")).toBeNull();
    expect(pasoAnterior("personas")).toBe("hechos");
    expect(pasoAnterior("hechos")).toBeNull();
  });

  it("numera desde 1 y anuncia el progreso en lenguaje claro", () => {
    expect(numeroPaso("revision")).toBe(4);
    expect(anuncioPaso("personas")).toBe("Paso 2 de 6: Personas o entes involucrados");
  });
});
