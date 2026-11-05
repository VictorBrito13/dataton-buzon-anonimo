import { generarFrase, PALABRAS_FRASE } from "@dataton/shared";
import { describe, expect, it } from "vitest";
import { confirmacionCorrecta, elegirPosiciones, palabrasDeFrase } from "./frase";

const FRASE = "ancla barco cielo dedo pera mesa";

describe("elegirPosiciones", () => {
  it("elige dos posiciones distintas y ordenadas dentro de la frase", () => {
    for (let i = 0; i < 200; i += 1) {
      const [a, b] = elegirPosiciones();
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(PALABRAS_FRASE);
      expect(a).toBeLessThan(b);
    }
  });

  it("no se atora si el azar repite el mismo número", () => {
    const valores = [3, 3, 3, 1];
    const [a, b] = elegirPosiciones(() => valores.shift() as number);
    expect([a, b]).toEqual([1, 3]);
  });
});

describe("confirmacionCorrecta", () => {
  it("acepta las palabras pedidas, sin importar acentos, mayúsculas ni espacios", () => {
    expect(confirmacionCorrecta(FRASE, [1, 4], [" BARCO ", "péra"])).toBe(true);
  });

  it("rechaza respuestas vacías, cambiadas o en otro orden", () => {
    expect(confirmacionCorrecta(FRASE, [1, 4], ["", ""])).toBe(false);
    expect(confirmacionCorrecta(FRASE, [1, 4], ["pera", "barco"])).toBe(false);
    expect(confirmacionCorrecta(FRASE, [1, 4], ["barco"])).toBe(false);
  });

  it("funciona con una frase real generada", () => {
    const frase = generarFrase();
    const palabras = palabrasDeFrase(frase);
    expect(confirmacionCorrecta(frase, [0, 5], [palabras[0] ?? "", palabras[5] ?? ""])).toBe(true);
  });
});
