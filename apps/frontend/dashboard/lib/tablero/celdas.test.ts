import { describe, expect, it } from "vitest";
import {
  CORTES_VACIOS,
  calcularCortes,
  etiquetaConteo,
  nivelDeConteo,
  ordenarCeldas,
  porcentajeDe,
} from "./celdas";

const k = 5;

describe("etiquetaConteo", () => {
  it("muestra el número con separador de miles", () => {
    expect(etiquetaConteo({ conteo: 1234, motivo: "publicada" }, k)).toBe("1,234");
  });
  it("muestra los ceros", () => {
    expect(etiquetaConteo({ conteo: 0, motivo: "publicada" }, k)).toBe("0");
  });
  it("una celda pequeña se muestra como < k", () => {
    expect(etiquetaConteo({ conteo: null, motivo: "menor_a_k" }, k)).toBe("< 5");
  });
  it("una supresión complementaria no dice < k: su valor puede ser mayor", () => {
    expect(etiquetaConteo({ conteo: null, motivo: "supresion_complementaria" }, k)).toBe("Oculta");
  });
});

describe("escala del mapa", () => {
  it("reparte los conteos publicados en cinco niveles por cuantiles", () => {
    const cortes = calcularCortes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(cortes).toHaveLength(4);
    expect(nivelDeConteo(1, cortes)).toBe(1);
    expect(nivelDeConteo(10, cortes)).toBe(5);
  });
  it("el cero tiene su propio nivel", () => {
    expect(nivelDeConteo(0, calcularCortes([0, 10, 20]))).toBe(0);
  });
  it("sin datos publicados no falla", () => {
    expect(calcularCortes([])).toEqual(CORTES_VACIOS);
    expect(nivelDeConteo(3, CORTES_VACIOS)).toBe(1);
  });
  it("ignora ceros al calcular los cortes", () => {
    expect(calcularCortes([0, 0, 0, 100])).toEqual([100, 100, 100, 100]);
  });
});

describe("ordenarCeldas", () => {
  it("ordena de mayor a menor con las ocultas al final", () => {
    const celdas = [
      { conteo: null, motivo: "menor_a_k" as const, id: "a" },
      { conteo: 3, motivo: "publicada" as const, id: "b" },
      { conteo: 9, motivo: "publicada" as const, id: "c" },
    ];
    expect(ordenarCeldas(celdas).map((c) => c.id)).toEqual(["c", "b", "a"]);
  });
});

describe("porcentajeDe", () => {
  it("escala la barra contra el máximo publicado", () => {
    expect(porcentajeDe(50, 200)).toBe(25);
    expect(porcentajeDe(0, 0)).toBe(0);
  });
});
