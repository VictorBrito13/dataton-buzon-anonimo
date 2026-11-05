/** Generador pseudoaleatorio determinista (mulberry32). No es apto para criptografía. */
export interface Azar {
  /** Real en [0, 1). */
  real(): number;
  /** Entero en [min, max], ambos incluidos. */
  entero(min: number, max: number): number;
  /** Elemento según pesos relativos. */
  ponderado<T>(opciones: readonly (readonly [T, number])[]): T;
}

export const crearAzar = (semilla: number): Azar => {
  let estado = semilla >>> 0;
  const real = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    real,
    entero: (min, max) => min + Math.floor(real() * (max - min + 1)),
    ponderado: <T>(opciones: readonly (readonly [T, number])[]): T => {
      const total = opciones.reduce((s, [, peso]) => s + peso, 0);
      let resto = real() * total;
      for (const [valor, peso] of opciones) {
        resto -= peso;
        if (resto < 0) return valor;
      }
      const ultimo = opciones.at(-1);
      if (!ultimo) throw new Error("ponderado() requiere opciones");
      return ultimo[0];
    },
  };
};
