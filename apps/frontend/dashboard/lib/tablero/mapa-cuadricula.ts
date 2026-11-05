import type { ClaveEstado } from "@dataton/shared";

/**
 * Mapa de cuadrícula: cada estado es una casilla del mismo tamaño, colocada de forma aproximada según
 * su ubicación. No son contornos reales, a propósito: no contamos con geometría de estados de licencia
 * verificada, y las casillas iguales evitan que los estados extensos parezcan los más importantes.
 */
export const CUADRICULA_ESTADOS: Record<
  ClaveEstado,
  { columna: number; fila: number; abreviatura: string }
> = {
  "02": { columna: 0, fila: 0, abreviatura: "BC" },
  "26": { columna: 1, fila: 0, abreviatura: "SON" },
  "08": { columna: 2, fila: 0, abreviatura: "CHH" },
  "05": { columna: 3, fila: 0, abreviatura: "COA" },
  "19": { columna: 4, fila: 0, abreviatura: "NL" },
  "28": { columna: 5, fila: 0, abreviatura: "TAM" },
  "03": { columna: 0, fila: 1, abreviatura: "BCS" },
  "25": { columna: 1, fila: 1, abreviatura: "SIN" },
  "10": { columna: 2, fila: 1, abreviatura: "DUR" },
  "32": { columna: 3, fila: 1, abreviatura: "ZAC" },
  "24": { columna: 4, fila: 1, abreviatura: "SLP" },
  "18": { columna: 1, fila: 2, abreviatura: "NAY" },
  "01": { columna: 2, fila: 2, abreviatura: "AGS" },
  "11": { columna: 3, fila: 2, abreviatura: "GTO" },
  "22": { columna: 4, fila: 2, abreviatura: "QRO" },
  "13": { columna: 5, fila: 2, abreviatura: "HGO" },
  "30": { columna: 6, fila: 2, abreviatura: "VER" },
  "14": { columna: 1, fila: 3, abreviatura: "JAL" },
  "16": { columna: 2, fila: 3, abreviatura: "MIC" },
  "15": { columna: 3, fila: 3, abreviatura: "MEX" },
  "09": { columna: 4, fila: 3, abreviatura: "CMX" },
  "29": { columna: 5, fila: 3, abreviatura: "TLX" },
  "21": { columna: 6, fila: 3, abreviatura: "PUE" },
  "27": { columna: 7, fila: 3, abreviatura: "TAB" },
  "04": { columna: 8, fila: 3, abreviatura: "CAM" },
  "31": { columna: 9, fila: 3, abreviatura: "YUC" },
  "06": { columna: 1, fila: 4, abreviatura: "COL" },
  "12": { columna: 3, fila: 4, abreviatura: "GRO" },
  "17": { columna: 4, fila: 4, abreviatura: "MOR" },
  "20": { columna: 5, fila: 4, abreviatura: "OAX" },
  "07": { columna: 7, fila: 4, abreviatura: "CHP" },
  "23": { columna: 9, fila: 4, abreviatura: "ROO" },
};
