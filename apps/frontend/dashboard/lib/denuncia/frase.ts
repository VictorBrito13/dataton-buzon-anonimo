import { PALABRAS_FRASE, normalizarFrase, normalizarPalabra } from "@dataton/shared";

export type Posiciones = readonly [number, number];

const azarSeguro = (maximo: number): number =>
  (crypto.getRandomValues(new Uint32Array(1))[0] as number) % maximo;

/** Dos palabras al azar y distintas: obliga a consultar la frase guardada, no a recordar la última. */
export const elegirPosiciones = (azar: (maximo: number) => number = azarSeguro): Posiciones => {
  const primera = azar(PALABRAS_FRASE);
  let segunda = azar(PALABRAS_FRASE);
  while (segunda === primera) segunda = azar(PALABRAS_FRASE);
  return primera < segunda ? [primera, segunda] : [segunda, primera];
};

export const palabrasDeFrase = (frase: string): string[] => normalizarFrase(frase).split(" ");

export const confirmacionCorrecta = (
  frase: string,
  posiciones: Posiciones,
  respuestas: readonly string[],
): boolean => {
  const palabras = palabrasDeFrase(frase);
  return (
    respuestas.length === posiciones.length &&
    posiciones.every((p, i) => {
      const respuesta = respuestas[i];
      return respuesta !== undefined && normalizarPalabra(respuesta) === palabras[p];
    })
  );
};
