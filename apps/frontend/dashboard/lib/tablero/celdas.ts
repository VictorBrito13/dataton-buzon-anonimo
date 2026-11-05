import type { CeldaAgregada } from "@dataton/shared";

type Conteo = Pick<CeldaAgregada, "conteo" | "motivo">;

const FORMATO = new Intl.NumberFormat("en-US");

export const formatoNumero = (n: number): string => FORMATO.format(n);

/**
 * "< k" solo para lo que de verdad es menor que k. Una supresión complementaria se oculta para
 * impedir una resta y su valor puede ser mucho mayor: decir "< 5" sería falso.
 */
export const etiquetaConteo = ({ conteo, motivo }: Conteo, k: number): string => {
  if (conteo !== null) return formatoNumero(conteo);
  return motivo === "menor_a_k" ? `< ${k}` : "Oculta";
};

export const CORTES_VACIOS = [0, 0, 0, 0];

/** Cuatro cortes por cuantiles que dan cinco niveles. Los ceros tienen nivel propio. */
export const calcularCortes = (conteos: readonly number[]): number[] => {
  const positivos = conteos.filter((n) => n > 0).sort((a, b) => a - b);
  if (positivos.length === 0) return CORTES_VACIOS;
  return [0.2, 0.4, 0.6, 0.8].map(
    (q) => positivos[Math.ceil(q * positivos.length) - 1] ?? positivos.at(-1) ?? 0,
  );
};

export const nivelDeConteo = (conteo: number, cortes: readonly number[]): number => {
  if (conteo === 0) return 0;
  if ((cortes[3] ?? 0) === 0) return 1;
  const indice = cortes.findIndex((corte) => conteo <= corte);
  return indice === -1 ? 5 : indice + 1;
};

export const ordenarCeldas = <T extends Conteo>(celdas: readonly T[]): T[] =>
  [...celdas].sort((a, b) => (b.conteo ?? -1) - (a.conteo ?? -1));

export const porcentajeDe = (valor: number, maximo: number): number =>
  maximo === 0 ? 0 : (valor / maximo) * 100;
