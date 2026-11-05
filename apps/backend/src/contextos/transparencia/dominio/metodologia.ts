import { acotarPorIntervalos } from "./ataque-intervalos.js";
import { anchoMinimo, protegerRed, redDeCubo } from "./k-anonimato.js";
import { TABLAS_PUBLICADAS } from "./publicacion.js";

/** En este prototipo las denuncias del tablero provienen del generador sintético (D9). */
export const DATOS_SINTETICOS = true;
export const K_INICIAL = 5;
export const REZAGO_DIAS_INICIAL = 14;

export const REGLAS = [
  "Una celda con entre 1 y k − 1 denuncias se oculta. Los ceros se publican: no identifican a nadie.",
  "En cada fila y columna con ocultas deben quedar al menos dos, con suma de k o más. Si no, se oculta además la publicada positiva más pequeña, hasta que nada cambie.",
  "La regla también une niveles: los municipios de un estado contra su total, y los estados contra el total nacional.",
  "Un total se publica solo si no permite deducir ninguna celda.",
  "Se publican como máximo dos dimensiones a la vez.",
  "Solo trimestres cerrados, con rezago y sin recalcular: nunca acumulados que se puedan restar.",
  "Antes de publicar, un atacante automático intenta acotar cada celda oculta. Si lo logra, se oculta más o no se publica.",
  "Nunca se publica nada sobre la persona denunciada.",
];

/** Lo que se puede afirmar con exactitud. Probado en ataques-k-anonimato.test.ts. */
export const textoGarantia = (k: number): string =>
  `Dentro de la publicación de un trimestre, a partir de los conteos, motivos, k y las sumas entre tablas y niveles, ` +
  `combinar restas (eliminación de variables) y propagar intervalos no permite acotar una celda oculta a un rango con ` +
  `diferencia menor que ${anchoMinimo(k)} entre máximo y mínimo: con k = ${k}, siempre quedan al menos ${anchoMinimo(k) + 1} valores ` +
  `posibles. El motor lo comprueba en cada publicación y se niega a publicar si falla. En pruebas con semilla fija, ` +
  `además, enumerar todas las soluciones enteras de tablas de hasta 4 × 4 tampoco lo rompió.`;

export const NO_CUBRE = [
  "No es privacidad diferencial: limita lo que se deduce de las cifras, no todo lo que se aprende de ellas.",
  "Quien ya sabe algo por fuera (por ejemplo, que tres de los casos son suyos) puede deducir más.",
  "Los ceros se publican: «< 5 de cohecho y 0 en lo demás» revela de qué tipo son todos los casos de ese lugar.",
  "En tablas grandes no se resuelve el problema como programación lineal completa, ni se modela la tabla de tres dimensiones que hay detrás de los cruces publicados.",
  "No se considera a un atacante que simule el motor para aprovechar qué celda eligió ocultar.",
  "Protege las cifras, no el contenido: alguien puede identificarse por lo que escribió en su denuncia.",
];

/** El ejemplo de la sección 7.2 de la propuesta, ejecutado por el motor real. */
export const ejemploAtaque = (k: number) => {
  const filas = ["A", "B", "C"];
  const columnas = ["cohecho", "abuso"];
  const conteos = [
    [23, 41],
    [12, 9],
    [1, 8],
  ];
  const red = redDeCubo({ filas, columnas, conteos });
  const vista = protegerRed(red, { k });
  const cotas = acotarPorIntervalos(vista, red.lineas, k);
  const leer = (id: string): number | null => vista.get(id)?.conteo ?? null;
  const rango = cotas.get("f:C|c:cohecho");
  if (!rango) throw new Error("El ejemplo no produjo una cota");
  return {
    original: filas.map((municipio, i) => ({
      municipio,
      cohecho: conteos[i]?.[0] ?? 0,
      abuso: conteos[i]?.[1] ?? 0,
      total: (conteos[i]?.[0] ?? 0) + (conteos[i]?.[1] ?? 0),
    })),
    protegida: filas.map((municipio) => ({
      municipio,
      cohecho: leer(`f:${municipio}|c:cohecho`),
      abuso: leer(`f:${municipio}|c:abuso`),
      total: leer(`f:${municipio}`),
    })),
    rango: { min: rango.min, max: rango.max },
    valorReal: 1,
  };
};

export const metodologia = (k: number, rezagoDias: number) => ({
  k,
  anchoMinimo: anchoMinimo(k),
  rezagoDias,
  datosSinteticos: DATOS_SINTETICOS,
  reglas: REGLAS,
  garantia: textoGarantia(k),
  noCubre: NO_CUBRE,
  ejemploAtaque: ejemploAtaque(k),
  tablas: [...TABLAS_PUBLICADAS],
});
