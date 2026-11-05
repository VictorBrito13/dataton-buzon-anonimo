/** Minúsculas, sin acentos y con un solo espacio: tolera errores al volver a escribirla. */
export const normalizarPalabra = (palabra: string): string =>
  palabra
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export const normalizarFrase = (frase: string): string =>
  frase.split(/\s+/).map(normalizarPalabra).filter(Boolean).join(" ");
