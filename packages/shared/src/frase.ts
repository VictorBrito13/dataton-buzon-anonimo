import { wordlist } from "@scure/bip39/wordlists/spanish.js";
import { normalizarFrase, normalizarPalabra } from "./normalizar.js";

/** 6 palabras de una lista de 2048: 66 bits de entropía. */
export const PALABRAS_FRASE = 6;

/** Se arma al primer uso: normalizar 2048 palabras al cargar la página frena a los celulares lentos. */
let listaNormalizada: ReadonlySet<string> | null = null;
const obtenerLista = (): ReadonlySet<string> => {
  listaNormalizada ??= new Set(wordlist.map(normalizarPalabra));
  return listaNormalizada;
};

export const fraseValida = (frase: string): boolean => {
  const palabras = normalizarFrase(frase).split(" ");
  const lista = obtenerLista();
  return palabras.length === PALABRAS_FRASE && palabras.every((p) => lista.has(p));
};

/** Genera la frase en el dispositivo con muestreo uniforme (2048 es potencia de 2). */
export const generarFrase = (): string => {
  const indices = crypto.getRandomValues(new Uint16Array(PALABRAS_FRASE));
  return Array.from(indices, (i) => normalizarPalabra(wordlist[i & 0x7ff] as string)).join(" ");
};
