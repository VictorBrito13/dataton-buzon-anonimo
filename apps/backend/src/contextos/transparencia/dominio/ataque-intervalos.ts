import type { CeldaVista, Linea } from "./k-anonimato.js";

/**
 * El atacante de referencia, también usado por el motor como auditoría antes de publicar. Solo
 * recibe lo público: conteos visibles, motivos y k.
 *
 * Combina dos técnicas: elimina variables entre todas las líneas, para encontrar restas que
 * atraviesan varias (total − fila − fila), y luego propaga intervalos por las ecuaciones hasta un
 * punto fijo. No equivale a programación lineal completa; ver dominio/metodologia.ts.
 */

export type Vista = ReadonlyMap<string, CeldaVista>;

export interface Cota {
  min: number;
  max: number;
}

/** Σ coeficiente · celda = constante. */
interface Ecuacion {
  terminos: Map<string, number>;
  constante: number;
}

/**
 * Lo que se afirma antes de hacer cuentas, con solo leer lo publicado:
 * - publicada: el valor exacto;
 * - "menor_a_k": entre 1 y k − 1;
 * - supresión complementaria: al menos k, porque todo positivo menor que k ya era "menor_a_k".
 *   La excepción son las celdas de una línea "abierta" (total oculto y ninguna parte positiva
 *   visible): es la única condición en la que el motor retira el motivo a una celda pequeña.
 */
export const cotasIniciales = (
  vista: Vista,
  lineas: readonly Linea[],
  k: number,
): Map<string, Cota> => {
  const pudoReetiquetarse = new Set<string>();
  for (const linea of lineas) {
    if (!esLineaAbierta(vista, linea)) continue;
    pudoReetiquetarse.add(linea.total);
    for (const parte of linea.partes) pudoReetiquetarse.add(parte);
  }
  const cotas = new Map<string, Cota>();
  for (const [id, celda] of vista) {
    if (celda.conteo !== null) cotas.set(id, { min: celda.conteo, max: celda.conteo });
    else if (celda.motivo === "menor_a_k") cotas.set(id, { min: 1, max: k - 1 });
    else cotas.set(id, { min: pudoReetiquetarse.has(id) ? 1 : k, max: Infinity });
  }
  return cotas;
};

export const esLineaAbierta = (vista: Vista, { total, partes }: Linea): boolean =>
  vista.get(total)?.conteo === null && !partes.some((p) => (vista.get(p)?.conteo ?? 0) > 0);

const comoEcuacion = ({ total, partes }: Linea): Ecuacion => {
  const terminos = new Map<string, number>([[total, 1]]);
  for (const parte of partes) terminos.set(parte, (terminos.get(parte) ?? 0) - 1);
  return { terminos, constante: 0 };
};

/** Estrecha las cotas con una ecuación. Devuelve las celdas que cambiaron o null si es inviable. */
const propagarEcuacion = (
  cotas: Map<string, Cota>,
  { terminos, constante }: Ecuacion,
): string[] | null => {
  let sumaMin = 0;
  let sumaMax = 0;
  let infinitosMin = 0;
  let infinitosMax = 0;
  const rango = (coef: number, cota: Cota): [number, number] =>
    coef > 0 ? [coef * cota.min, coef * cota.max] : [coef * cota.max, coef * cota.min];

  for (const [id, coef] of terminos) {
    const cota = cotas.get(id);
    if (!cota) throw new Error(`Celda sin cota: ${id}`);
    const [bajo, alto] = rango(coef, cota);
    if (bajo === -Infinity) infinitosMin += 1;
    else sumaMin += bajo;
    if (alto === Infinity) infinitosMax += 1;
    else sumaMax += alto;
  }

  const cambiaron: string[] = [];
  for (const [id, coef] of terminos) {
    const cota = cotas.get(id);
    if (!cota) continue;
    const [bajo, alto] = rango(coef, cota);
    // Rango de la suma de los demás términos, sin este.
    const restoMin =
      infinitosMin - (bajo === -Infinity ? 1 : 0) > 0
        ? -Infinity
        : sumaMin - (bajo === -Infinity ? 0 : bajo);
    const restoMax =
      infinitosMax - (alto === Infinity ? 1 : 0) > 0
        ? Infinity
        : sumaMax - (alto === Infinity ? 0 : alto);
    const a = (constante - restoMax) / coef;
    const b = (constante - restoMin) / coef;
    const nuevoMin = Math.ceil(Math.min(a, b) - 1e-9);
    const nuevoMax = Math.floor(Math.max(a, b) + 1e-9);
    if (nuevoMin > cota.min || nuevoMax < cota.max) {
      cota.min = Math.max(cota.min, nuevoMin);
      cota.max = Math.min(cota.max, nuevoMax);
      if (cota.min > cota.max) return null;
      cambiaron.push(id);
      // Las sumas quedaron desactualizadas: el ciclo vuelve a procesar esta ecuación.
      return cambiaron;
    }
  }
  return cambiaron;
};

const propagarEcuaciones = (cotas: Map<string, Cota>, ecuaciones: readonly Ecuacion[]): boolean => {
  const ecuacionesDe = new Map<string, Ecuacion[]>();
  for (const ecuacion of ecuaciones) {
    for (const id of ecuacion.terminos.keys()) {
      const lista = ecuacionesDe.get(id);
      if (lista) lista.push(ecuacion);
      else ecuacionesDe.set(id, [ecuacion]);
    }
  }
  const pendientes = new Set(ecuaciones);
  while (pendientes.size > 0) {
    for (const ecuacion of pendientes) {
      pendientes.delete(ecuacion);
      const cambiaron = propagarEcuacion(cotas, ecuacion);
      if (cambiaron === null) return false;
      for (const id of cambiaron) {
        for (const vecina of ecuacionesDe.get(id) ?? []) pendientes.add(vecina);
      }
    }
  }
  return true;
};

/** Propagación pura por líneas. La usa el atacante por enumeración de las pruebas. */
export const propagar = (cotas: Map<string, Cota>, lineas: readonly Linea[]): boolean =>
  propagarEcuaciones(cotas, lineas.map(comoEcuacion));

const mcd = (a: number, b: number): number => {
  let [x, y] = [Math.abs(a), Math.abs(b)];
  while (y > 0) [x, y] = [y, x % y];
  return x;
};

const simplificar = (e: Ecuacion): void => {
  let divisor = Math.abs(e.constante);
  for (const coef of e.terminos.values()) divisor = mcd(divisor, coef);
  if (divisor <= 1) return;
  for (const [id, coef] of e.terminos) e.terminos.set(id, coef / divisor);
  e.constante /= divisor;
};

/** Sustituye en `fila` la variable `pivote` usando `base`, sin fracciones. */
const eliminar = (fila: Ecuacion, base: Ecuacion, pivote: string): void => {
  const a = fila.terminos.get(pivote) ?? 0;
  const p = base.terminos.get(pivote) ?? 0;
  const divisor = mcd(a, p);
  const m = p / divisor;
  const n = a / divisor;
  for (const [id, coef] of fila.terminos) fila.terminos.set(id, coef * m);
  for (const [id, coef] of base.terminos) {
    const valor = (fila.terminos.get(id) ?? 0) - n * coef;
    if (!Number.isSafeInteger(valor)) throw new Error("Desbordamiento al eliminar variables");
    if (valor === 0) fila.terminos.delete(id);
    else fila.terminos.set(id, valor);
  }
  fila.constante = fila.constante * m - n * base.constante;
  simplificar(fila);
};

/**
 * Forma reducida del sistema sobre las celdas ocultas. Cada fila es una resta implícita: si queda
 * con una sola variable, esa celda está determinada aunque ninguna línea individual la revele.
 */
const reducir = (vista: Vista, lineas: readonly Linea[]): Ecuacion[] => {
  const filas = new Set<Ecuacion>();
  const filasCon = new Map<string, Set<Ecuacion>>();
  const pivotes = new Map<string, Ecuacion>();

  const registrar = (fila: Ecuacion, ids: Iterable<string>, alta: boolean): void => {
    for (const id of ids) {
      const conjunto = filasCon.get(id) ?? new Set<Ecuacion>();
      if (alta) conjunto.add(fila);
      else conjunto.delete(fila);
      filasCon.set(id, conjunto);
    }
  };

  for (const linea of lineas) {
    const fila: Ecuacion = { terminos: new Map(), constante: 0 };
    const sumar = (id: string, signo: number): void => {
      const conteo = vista.get(id)?.conteo;
      if (conteo === null) fila.terminos.set(id, (fila.terminos.get(id) ?? 0) + signo);
      else fila.constante -= signo * (conteo ?? 0);
    };
    sumar(linea.total, 1);
    for (const parte of linea.partes) sumar(parte, -1);
    if (fila.terminos.size === 0) continue;

    for (const [pivote, base] of pivotes) {
      if (fila.terminos.has(pivote)) eliminar(fila, base, pivote);
    }
    if (fila.terminos.size === 0) {
      if (fila.constante !== 0) throw new Error("Lo publicado es incoherente con sus líneas");
      continue;
    }

    const [pivote] = [...fila.terminos.keys()].sort(
      (a, b) => (filasCon.get(a)?.size ?? 0) - (filasCon.get(b)?.size ?? 0),
    );
    if (pivote === undefined) continue;
    for (const otra of [...(filasCon.get(pivote) ?? [])]) {
      const antes = [...otra.terminos.keys()];
      registrar(otra, antes, false);
      eliminar(otra, fila, pivote);
      registrar(otra, otra.terminos.keys(), true);
    }
    filas.add(fila);
    pivotes.set(pivote, fila);
    registrar(fila, fila.terminos.keys(), true);
  }
  return [...filas];
};

const sistemaDe = (vista: Vista, lineas: readonly Linea[]): Ecuacion[] => [
  ...lineas.map(comoEcuacion),
  ...reducir(vista, lineas),
];

const copiar = (cotas: ReadonlyMap<string, Cota>): Map<string, Cota> =>
  new Map([...cotas].map(([id, c]) => [id, { min: c.min, max: c.max }]));

/** Versión rápida, sin sondeo. La usa el motor para descartar opciones antes del ataque completo. */
export const acotarRapido = (
  vista: Vista,
  lineas: readonly Linea[],
  k: number,
): Map<string, Cota> => {
  const cotas = cotasIniciales(vista, lineas, k);
  if (!propagarEcuaciones(cotas, sistemaDe(vista, lineas))) {
    throw new Error("Lo publicado es incoherente con sus líneas");
  }
  return cotas;
};

/**
 * Mejor rango que el atacante puede deducir para cada celda. Además de propagar, sondea: supone que
 * una celda vale su extremo y descarta el valor si el sistema se vuelve imposible, hasta que nada
 * cambie. Encuentra fugas que la propagación sola no ve. Solo sondea rangos cortos: en uno largo un
 * extremo descartado no acerca la cota al ancho mínimo.
 */
export const acotarPorIntervalos = (
  vista: Vista,
  lineas: readonly Linea[],
  k: number,
): Map<string, Cota> => {
  const cotas = cotasIniciales(vista, lineas, k);
  const sistema = sistemaDe(vista, lineas);
  if (!propagarEcuaciones(cotas, sistema)) {
    throw new Error("Lo publicado es incoherente con sus líneas");
  }
  const maximoAncho = 3 * k;
  const ocultas = [...vista].filter(([, c]) => c.conteo === null).map(([id]) => id);

  const esPosible = (id: string, valor: number): boolean => {
    const intento = copiar(cotas);
    intento.set(id, { min: valor, max: valor });
    return propagarEcuaciones(intento, sistema);
  };

  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const id of ocultas) {
      const cota = cotas.get(id);
      if (!cota || cota.max - cota.min > maximoAncho) continue;
      let antes = `${cota.min}:${cota.max}`;
      while (cota.min < cota.max && !esPosible(id, cota.min)) cota.min += 1;
      while (cota.min < cota.max && !esPosible(id, cota.max)) cota.max -= 1;
      if (`${cota.min}:${cota.max}` !== antes) {
        antes = `${cota.min}:${cota.max}`;
        cambio = true;
        if (!propagarEcuaciones(cotas, sistema)) {
          throw new Error("Lo publicado es incoherente con sus líneas");
        }
      }
    }
  }
  return cotas;
};
