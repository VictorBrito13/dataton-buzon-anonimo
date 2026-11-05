import { wordlist } from "@scure/bip39/wordlists/spanish.js";
import { argon2id } from "hash-wasm";

/** 6 palabras de una lista de 2048: 66 bits de entropía. */
export const PALABRAS_FRASE = 6;

/** Sal fija por versión: la derivación debe ser determinista para poder buscar por frase. */
const SAL_ACCESO = "buzon-anonimo/acceso/v1";

/** Parámetros mínimos de OWASP para Argon2id, viables en celulares de gama baja. */
const ARGON2 = { parallelism: 1, iterations: 2, memorySize: 19_456, hashLength: 32 } as const;

/** Minúsculas, sin acentos y con un solo espacio: tolera errores al volver a escribirla. */
export const normalizarPalabra = (palabra: string): string =>
  palabra
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const LISTA_NORMALIZADA: ReadonlySet<string> = new Set(wordlist.map(normalizarPalabra));

export const normalizarFrase = (frase: string): string =>
  frase.split(/\s+/).map(normalizarPalabra).filter(Boolean).join(" ");

export const fraseValida = (frase: string): boolean => {
  const palabras = normalizarFrase(frase).split(" ");
  return palabras.length === PALABRAS_FRASE && palabras.every((p) => LISTA_NORMALIZADA.has(p));
};

/** Genera la frase en el dispositivo con muestreo uniforme (2048 es potencia de 2). */
export const generarFrase = (): string => {
  const indices = crypto.getRandomValues(new Uint16Array(PALABRAS_FRASE));
  return Array.from(indices, (i) => normalizarPalabra(wordlist[i & 0x7ff] as string)).join(" ");
};

/**
 * Deriva en el dispositivo el identificador que sí viaja al servidor. La frase
 * nunca sale del navegador. Devuelve 32 bytes en hexadecimal.
 */
export const derivarAccesoId = (frase: string): Promise<string> =>
  argon2id({
    ...ARGON2,
    password: normalizarFrase(frase),
    salt: new TextEncoder().encode(SAL_ACCESO),
    outputType: "hex",
  });
