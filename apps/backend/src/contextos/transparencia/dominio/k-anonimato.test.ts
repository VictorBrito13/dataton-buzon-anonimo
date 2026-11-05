import { describe, expect, it } from "vitest";
import { anchoMinimo, aplicarKAnonimato, protegerRed, type CuboConteos } from "./k-anonimato.js";

const cubo = (conteos: number[][]): CuboConteos => ({
  filas: conteos.map((_, i) => `f${i}`),
  columnas: (conteos[0] ?? []).map((_, j) => `c${j}`),
  conteos,
});
const k = 5;

describe("regla 1: celdas pequeñas", () => {
  it("suprime 0 < n < k y deja de mostrar su valor", () => {
    const r = aplicarKAnonimato(cubo([[3, 20, 30]]), { k });
    expect(r.celdas[0]?.[0]).toEqual({ conteo: null, motivo: "menor_a_k" });
  });

  it("publica los ceros: no identifican a nadie", () => {
    const r = aplicarKAnonimato(cubo([[0, 20, 30]]), { k });
    expect(r.celdas[0]?.[0]).toEqual({ conteo: 0, motivo: "publicada" });
  });

  it("publica n = k", () => {
    const r = aplicarKAnonimato(cubo([[5, 20, 30]]), { k });
    expect(r.celdas[0]?.[0]).toEqual({ conteo: 5, motivo: "publicada" });
  });

  it("rechaza k < 3, porque '< 2' equivale a publicar el valor exacto", () => {
    expect(() => aplicarKAnonimato(cubo([[1]]), { k: 2 })).toThrow(/k/);
  });

  it("rechaza conteos negativos o no enteros", () => {
    expect(() => aplicarKAnonimato(cubo([[-1]]), { k })).toThrow();
    expect(() => aplicarKAnonimato(cubo([[1.5]]), { k })).toThrow();
  });
});

describe("regla 2: supresión complementaria en filas y columnas", () => {
  it("una sola suprimida en la fila arrastra a la publicada más pequeña", () => {
    const r = aplicarKAnonimato(cubo([[3, 20, 30]]), { k });
    expect(r.celdas[0]?.[1]).toEqual({ conteo: null, motivo: "supresion_complementaria" });
    expect(r.celdas[0]?.[2]?.conteo).toBe(30);
  });

  it("dos suprimidas que suman menos que k obligan a una tercera", () => {
    const r = aplicarKAnonimato(cubo([[1, 1, 20, 30]]), { k });
    expect(r.celdas[0]?.[2]?.conteo).toBeNull();
    expect(r.celdas[0]?.[3]?.conteo).toBe(30);
  });

  it("la supresión se propaga por filas y columnas hasta un punto fijo", () => {
    const r = aplicarKAnonimato(
      cubo([
        [3, 20, 30],
        [40, 50, 60],
      ]),
      { k },
    );
    for (const fila of r.celdas) {
      expect(fila.filter((c) => c.conteo === null).length).not.toBe(1);
    }
    for (let j = 0; j < 3; j += 1) {
      expect(r.celdas.filter((f) => f[j]?.conteo === null).length).not.toBe(1);
    }
  });

  it("no gasta la supresión complementaria en un cero: no aporta a la suma", () => {
    const r = aplicarKAnonimato(cubo([[3, 0, 10]]), { k });
    expect(r.celdas[0]?.[1]).toEqual({ conteo: 0, motivo: "publicada" });
    expect(r.celdas[0]?.[2]?.conteo).toBeNull();
  });

  it("es determinista", () => {
    const c = cubo([
      [3, 20, 1],
      [8, 2, 40],
    ]);
    expect(aplicarKAnonimato(c, { k })).toEqual(aplicarKAnonimato(c, { k }));
  });
});

describe("regla 4: totales", () => {
  it("oculta el total de una línea cuando su valor es menor que k", () => {
    const r = aplicarKAnonimato(cubo([[3, 0, 0]]), { k });
    expect(r.totalesFila[0]?.conteo).toBeNull();
    expect(r.total.conteo).toBeNull();
  });

  it("publica el total si no permite deducir ninguna celda", () => {
    const r = aplicarKAnonimato(
      cubo([
        [50, 20],
        [30, 60],
      ]),
      { k },
    );
    expect(r.totalesFila.map((t) => t.conteo)).toEqual([70, 90]);
    expect(r.total.conteo).toBe(160);
  });

  it("oculta el total si con las reglas de línea todavía revelaría el valor exacto", () => {
    // 4 + 4 = 8 cumple "dos suprimidas con suma ≥ k", pero 8 solo puede ser 4 + 4.
    const r = aplicarKAnonimato(cubo([[4, 4]]), { k });
    expect(r.totalesFila[0]?.conteo).toBeNull();
  });
});

describe("protegerRed", () => {
  it("rechaza una red cuyas líneas no suman: publicaría cifras incoherentes", () => {
    expect(() =>
      protegerRed(
        {
          conteos: new Map([
            ["T", 10],
            ["a", 3],
            ["b", 3],
          ]),
          lineas: [{ total: "T", partes: ["a", "b"] }],
        },
        { k },
      ),
    ).toThrow(/no suma/);
  });
});

describe("anchoMinimo", () => {
  it("exige al menos tres valores posibles con k = 5 y crece con k", () => {
    expect(anchoMinimo(5)).toBe(2);
    expect(anchoMinimo(3)).toBe(1);
    expect(anchoMinimo(10)).toBe(5);
  });
});
