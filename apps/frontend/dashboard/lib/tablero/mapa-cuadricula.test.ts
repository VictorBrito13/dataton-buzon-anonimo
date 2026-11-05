import { CLAVES_ESTADO } from "@dataton/shared";
import { describe, expect, it } from "vitest";
import { CUADRICULA_ESTADOS } from "./mapa-cuadricula";

describe("mapa de cuadrícula", () => {
  it("incluye cada estado exactamente una vez", () => {
    expect(Object.keys(CUADRICULA_ESTADOS).sort()).toEqual([...CLAVES_ESTADO].sort());
  });

  it("no encima dos estados en una misma casilla", () => {
    const posiciones = Object.values(CUADRICULA_ESTADOS).map((c) => `${c.columna},${c.fila}`);
    expect(new Set(posiciones).size).toBe(posiciones.length);
  });

  it("las abreviaturas son únicas", () => {
    const abreviaturas = Object.values(CUADRICULA_ESTADOS).map((c) => c.abreviatura);
    expect(new Set(abreviaturas).size).toBe(32);
  });
});
