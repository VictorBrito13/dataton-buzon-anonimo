import { describe, expect, it } from "vitest";
import { crearAzar } from "./azar.js";
import {
  acotarPorIntervalos,
  cotasIniciales,
  propagar,
  type Cota,
  type Vista,
} from "./ataque-intervalos.js";
import {
  anchoMinimo,
  aplicarKAnonimato,
  protegerRed,
  redDeCubo,
  type Linea,
  type RedConteos,
} from "./k-anonimato.js";

/**
 * HU-31. Cada prueba actúa como atacante: solo ve lo publicado (conteos, motivos, k) y debe
 * fracasar. La garantía exacta está en dominio/metodologia.ts.
 */

const k = 5;

/** Atacante: solo recibe la vista pública; nunca los conteos reales. */
const atacar = (red: RedConteos, kUsada = k) => {
  const vista = protegerRed(red, { k: kUsada });
  return { vista, cotas: acotarPorIntervalos(vista, red.lineas, kUsada) };
};

const exigirProtegida = (red: RedConteos, kUsada = k) => {
  const { vista, cotas } = atacar(red, kUsada);
  for (const [id, celda] of vista) {
    const real = red.conteos.get(id) ?? 0;
    const cota = cotas.get(id);
    if (!cota) throw new Error(`Sin cota para ${id}`);
    expect(cota.min, `${id}: el valor real debe seguir dentro de la cota`).toBeLessThanOrEqual(real);
    expect(cota.max, `${id}: el valor real debe seguir dentro de la cota`).toBeGreaterThanOrEqual(
      real,
    );
    if (celda.conteo === null) {
      expect(cota.max - cota.min, `${id}: ancho de la cota`).toBeGreaterThanOrEqual(
        anchoMinimo(kUsada),
      );
    }
  }
};

describe("HU-31 · Ataques al k-anonimato", () => {
  describe("ejemplo exacto de la sección 7.2 de la propuesta", () => {
    const tabla = [
      [23, 41],
      [12, 9],
      [1, 8],
    ];
    const red = redDeCubo({
      filas: ["A", "B", "C"],
      columnas: ["cohecho", "abuso"],
      conteos: tabla,
    });

    it("sin protección, 9 − 8 revela que la celda '< 5' es exactamente 1", () => {
      const totalC = 9;
      const abusoC = 8;
      expect(totalC - abusoC).toBe(tabla[2]?.[0]);
    });

    it("con protección, el 8 ya no se publica junto al total y la resta no es posible", () => {
      const r = aplicarKAnonimato(
        { filas: ["A", "B", "C"], columnas: ["cohecho", "abuso"], conteos: tabla },
        { k },
      );
      expect(r.celdas[2]?.[0]?.conteo).toBeNull();
      expect(r.celdas[2]?.[1]?.conteo).toBeNull();
    });

    it("el mejor atacante solo llega a un rango de 1 a 4, no a 1", () => {
      const { cotas } = atacar(red);
      const cota = cotas.get("f:C|c:cohecho");
      expect(cota).toEqual({ min: 1, max: 4 });
    });

    it("toda celda oculta conserva el ancho mínimo", () => {
      exigirProtegida(red);
    });
  });

  it("resta en fila: total de fila menos las celdas visibles", () => {
    exigirProtegida(
      redDeCubo({
        filas: ["a", "b"],
        columnas: ["x", "y", "z"],
        conteos: [
          [2, 30, 40],
          [50, 60, 70],
        ],
      }),
    );
  });

  it("resta en columna: total de columna menos las celdas visibles", () => {
    exigirProtegida(
      redDeCubo({
        filas: ["a", "b", "c"],
        columnas: ["x", "y"],
        conteos: [
          [2, 30],
          [40, 50],
          [60, 70],
        ],
      }),
    );
  });

  it("dos suprimidas que suman casi nada: 1 + 5 = 6 no debe revelar el 1", () => {
    // Cumple la regla literal "dos suprimidas con suma ≥ k". Como el motivo se publica, el atacante
    // sabe que una es menor que k y otra mayor o igual: 1 + 5 = 6 solo admite esa solución.
    exigirProtegida(redDeCubo({ filas: ["a"], columnas: ["x", "y"], conteos: [[1, 5]] }));
  });

  it("dos suprimidas al máximo: 4 + 4 = 8 solo puede ser 4 y 4", () => {
    exigirProtegida(
      redDeCubo({
        filas: ["a", "b"],
        columnas: ["x", "y"],
        conteos: [
          [4, 4],
          [50, 60],
        ],
      }),
    );
  });

  it("cuatro celdas positivas bajo un total menor que k: 1+1+1+1 = 4 no se deduce", () => {
    exigirProtegida(
      redDeCubo({
        filas: ["a", "b"],
        columnas: ["w", "x", "y", "z"],
        conteos: [
          [1, 1, 1, 1],
          [30, 40, 50, 60],
        ],
      }),
    );
  });

  describe("resta entre niveles: municipio, estado, nacional", () => {
    const red: RedConteos = {
      conteos: new Map([
        ["nacional", 212],
        ["estado:A", 112],
        ["estado:B", 100],
        ["mun:A1", 2],
        ["mun:A2", 50],
        ["mun:A3", 60],
        ["mun:B1", 40],
        ["mun:B2", 60],
      ]),
      lineas: [
        { total: "nacional", partes: ["estado:A", "estado:B"] },
        { total: "estado:A", partes: ["mun:A1", "mun:A2", "mun:A3"] },
        { total: "estado:B", partes: ["mun:B1", "mun:B2"] },
      ],
    };

    it("total estatal menos municipios visibles no revela al municipio pequeño", () => {
      exigirProtegida(red);
      expect(protegerRed(red, { k }).get("mun:A1")?.conteo).toBeNull();
    });

    it("un estado completo menor que k tampoco se deduce del nacional", () => {
      exigirProtegida({
        conteos: new Map([
          ["nacional", 83],
          ["estado:A", 3],
          ["estado:B", 80],
          ["mun:A1", 3],
          ["mun:B1", 80],
        ]),
        lineas: [
          { total: "nacional", partes: ["estado:A", "estado:B"] },
          { total: "estado:A", partes: ["mun:A1"] },
          { total: "estado:B", partes: ["mun:B1"] },
        ],
      });
    });

    it("ocultar un total arrastra también al nivel superior", () => {
      const vista = protegerRed(
        {
          conteos: new Map([
            ["nacional", 8],
            ["estado:A", 8],
            ["mun:A1", 4],
            ["mun:A2", 4],
          ]),
          lineas: [
            { total: "nacional", partes: ["estado:A"] },
            { total: "estado:A", partes: ["mun:A1", "mun:A2"] },
          ],
        },
        { k },
      );
      expect(vista.get("estado:A")?.conteo).toBeNull();
      expect(vista.get("nacional")?.conteo).toBeNull();
    });
  });

  it("el atacante también usa el motivo publicado y sus cotas siguen conteniendo la verdad", () => {
    const red = redDeCubo({
      filas: ["a", "b"],
      columnas: ["x", "y"],
      conteos: [
        [1, 7],
        [9, 20],
      ],
    });
    const { vista } = atacar(red);
    const iniciales = cotasIniciales(vista, red.lineas, k);
    expect(iniciales.get("f:a|c:x")).toEqual({ min: 1, max: 4 });
    expect(iniciales.get("f:a|c:y")?.min).toBe(5);
    exigirProtegida(red);
  });

  describe("propiedad: cubos aleatorios con semilla fija", () => {
    const generar = (azar: ReturnType<typeof crearAzar>, filas: number, columnas: number) => {
      // Mezcla de conteos ralos y grandes, parecida a municipios pequeños y grandes.
      const conteos = Array.from({ length: filas }, () =>
        Array.from({ length: columnas }, () => {
          const tipo = azar.real();
          if (tipo < 0.25) return 0;
          if (tipo < 0.6) return azar.entero(1, 4);
          if (tipo < 0.8) return azar.entero(5, 9);
          return azar.entero(10, 90);
        }),
      );
      return redDeCubo({
        filas: conteos.map((_, i) => `f${i}`),
        columnas: Array.from({ length: columnas }, (_, j) => `c${j}`),
        conteos,
      });
    };

    it("2,000 cubos: el atacante por intervalos nunca acota con ancho menor al mínimo", () => {
      const azar = crearAzar(20261113);
      let suprimidas = 0;
      for (let n = 0; n < 2000; n += 1) {
        const red = generar(azar, azar.entero(1, 8), azar.entero(1, 8));
        const vista = protegerRed(red, { k });
        const cotas = acotarPorIntervalos(vista, red.lineas, k);
        for (const [id, celda] of vista) {
          const real = red.conteos.get(id) ?? 0;
          const cota = cotas.get(id);
          if (!cota) throw new Error(`Sin cota para ${id}`);
          if (cota.min > real || cota.max < real) {
            throw new Error(`Cota falsa en el cubo ${n}, ${id}: ${JSON.stringify(cota)} vs ${real}`);
          }
          if (celda.conteo === null) {
            suprimidas += 1;
            if (cota.max - cota.min < anchoMinimo(k)) {
              throw new Error(`Cubo ${n}, ${id}: ancho ${cota.max - cota.min}`);
            }
          }
        }
      }
      expect(suprimidas).toBeGreaterThan(5000);
    });

    it.each([3, 4, 7, 10])("también con k = %i", (kPrueba) => {
      const azar = crearAzar(kPrueba * 1000);
      for (let n = 0; n < 300; n += 1) {
        exigirProtegida(generar(azar, azar.entero(1, 6), azar.entero(1, 6)), kPrueba);
      }
    });

    it("500 cubos pequeños: enumerar todas las soluciones enteras tampoco lo logra", () => {
      const azar = crearAzar(13112026);
      let conSupresion = 0;
      for (let n = 0; n < 500; n += 1) {
        const red = generar(azar, azar.entero(2, 4), azar.entero(2, 4));
        const vista = protegerRed(red, { k });
        if (![...vista.values()].some((c) => c.conteo === null)) continue;
        conSupresion += 1;
        const exacta = enumerarSoluciones(vista, red.lineas, k);
        for (const [id, celda] of vista) {
          if (celda.conteo !== null) continue;
          const rango = exacta.get(id);
          if (!rango) throw new Error(`Sin soluciones para ${id}`);
          const real = red.conteos.get(id) ?? 0;
          expect(rango.min).toBeLessThanOrEqual(real);
          if (rango.max - rango.min < anchoMinimo(k)) {
            throw new Error(
              `Cubo ${n}, ${id}: rango exacto ${rango.min}..${rango.max} con ${JSON.stringify([...red.conteos])}`,
            );
          }
        }
      }
      expect(conSupresion).toBeGreaterThan(300);
    });
  });
});

/**
 * Atacante independiente del motor: recorre todas las asignaciones enteras compatibles con lo
 * publicado. Solo es viable en tablas pequeñas. Las cotas iniciales solo limitan la búsqueda.
 */
const enumerarSoluciones = (vista: Vista, lineas: readonly Linea[], kUsada: number) => {
  const iniciales = acotarPorIntervalos(vista, lineas, kUsada);
  const ocultas = [...vista].filter(([, c]) => c.conteo === null).map(([id]) => id);
  const copiar = (cotas: Map<string, Cota>): Map<string, Cota> =>
    new Map([...cotas].map(([id, c]) => [id, { ...c }]));

  /** Búsqueda completa: fija una celda a la vez y comprueba las sumas al llegar a una hoja. */
  const hayEntera = (cotas: Map<string, Cota>): boolean => {
    if (!propagar(cotas, lineas)) return false;
    const libre = ocultas.find((id) => {
      const c = cotas.get(id);
      return c !== undefined && c.min !== c.max;
    });
    if (libre === undefined) {
      return lineas.every(
        ({ total, partes }) =>
          partes.reduce((s, p) => s + (cotas.get(p)?.min ?? NaN), 0) === cotas.get(total)?.min,
      );
    }
    const cota = cotas.get(libre);
    if (!cota) return false;
    // Una celda sin máximo solo aparece si su línea tampoco tiene máximo: siempre cabe más.
    const tope = Math.min(cota.max, cota.min + 500);
    for (let v = cota.min; v <= tope; v += 1) {
      const intento = copiar(cotas);
      intento.set(libre, { min: v, max: v });
      if (hayEntera(intento)) return true;
    }
    return false;
  };

  const rango = new Map<string, { min: number; max: number }>();
  for (const id of ocultas) {
    const cota = iniciales.get(id);
    if (!cota) continue;
    // Basta con encontrar más valores posibles que el ancho exigido; no hace falta seguir.
    const tope = Math.min(cota.max, cota.min + 1000);
    for (let v = cota.min; v <= tope; v += 1) {
      const intento = copiar(iniciales);
      intento.set(id, { min: v, max: v });
      if (!hayEntera(intento)) continue;
      const previo = rango.get(id);
      rango.set(id, { min: previo?.min ?? v, max: v });
      if (v - (previo?.min ?? v) > anchoMinimo(kUsada)) break;
    }
  }
  return rango;
};
