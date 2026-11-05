import { acotarPorIntervalos, acotarRapido, esLineaAbierta } from "./ataque-intervalos.js";

/**
 * Motor de k-anonimato (D6 de docs/decisiones-arquitectura.md). Función pura sobre una red de
 * conteos: cada línea dice "este total es la suma de estas partes". Una tabla de dos dimensiones,
 * sus márgenes y los niveles municipio, estado y nacional son todos líneas de la misma red, de modo
 * que la resta entre tablas se trata igual que la resta en una fila.
 *
 * Etapas, repetidas hasta un punto fijo:
 * 1. Reglas D6 por línea (supresión primaria, complementaria y de totales).
 * 2. Auditoría: un atacante por intervalos ataca la vista. D6 por sí sola no basta (4 + 4 = 8 cumple
 *    "dos suprimidas con suma ≥ k" y aun así revela ambas celdas), así que lo que no alcance
 *    `anchoMinimo` se protege más. Si no se logra, se lanza un error: nunca se publica.
 */

export type Motivo = "publicada" | "menor_a_k" | "supresion_complementaria";

export interface CeldaVista {
  conteo: number | null;
  motivo: Motivo;
}

export interface Linea {
  total: string;
  partes: readonly string[];
}

export interface RedConteos {
  conteos: ReadonlyMap<string, number>;
  lineas: readonly Linea[];
}

export interface CuboConteos {
  filas: readonly string[];
  columnas: readonly string[];
  /** conteos[fila][columna] */
  conteos: readonly (readonly number[])[];
}

export interface ParametrosK {
  k: number;
}

/** Menor ancho (máximo − mínimo) admisible para lo que un atacante acote de una celda oculta. */
export const anchoMinimo = (k: number): number => Math.max(1, Math.ceil((k - 1) / 2));

const validar = ({ conteos, lineas }: RedConteos, k: number): void => {
  if (!Number.isInteger(k) || k < 3) {
    throw new Error(`k debe ser un entero mayor o igual que 3; se recibió ${k}`);
  }
  for (const [id, n] of conteos) {
    if (!Number.isInteger(n) || n < 0) throw new Error(`Conteo inválido en ${id}: ${n}`);
  }
  for (const { total, partes } of lineas) {
    const suma = partes.reduce((s, p) => s + (conteos.get(p) ?? NaN), 0);
    if (suma !== conteos.get(total)) {
      throw new Error(`La línea de ${total} no suma: ${suma} frente a ${conteos.get(total)}`);
    }
  }
};

const PROFUNDIDAD_REFUERZO = 2;
const MAX_OPCIONES_PROBADAS = 12;

class Protector {
  private readonly vista = new Map<string, CeldaVista>();
  private readonly lineasDe = new Map<string, Linea[]>();
  private readonly lineas: readonly Linea[];

  constructor(
    private readonly red: RedConteos,
    private readonly k: number,
  ) {
    // Una línea cuyo total es cero solo contiene ceros públicos: no hay nada que proteger.
    this.lineas = red.lineas.filter((l) => this.valor(l.total) > 0);
    for (const linea of this.lineas) {
      for (const id of [linea.total, ...linea.partes]) {
        const lista = this.lineasDe.get(id);
        if (lista) lista.push(linea);
        else this.lineasDe.set(id, [linea]);
      }
    }
    for (const [id, n] of red.conteos) {
      this.vista.set(
        id,
        n > 0 && n < k ? { conteo: null, motivo: "menor_a_k" } : { conteo: n, motivo: "publicada" },
      );
    }
  }

  private valor(id: string): number {
    return this.red.conteos.get(id) ?? 0;
  }

  private oculta(id: string): boolean {
    return this.vista.get(id)?.conteo === null;
  }

  private ocultar(id: string): void {
    this.vista.set(id, { conteo: null, motivo: "supresion_complementaria" });
  }

  /** La publicada positiva más pequeña; un cero no aporta a la suma oculta. */
  private menorPublicada(partes: readonly string[]): string | undefined {
    let mejor: string | undefined;
    for (const id of partes) {
      if (this.oculta(id) || this.valor(id) === 0) continue;
      if (mejor === undefined || this.valor(id) < this.valor(mejor)) mejor = id;
    }
    return mejor;
  }

  /** Aplica la regla de una línea una vez. Devuelve true si ocultó algo. */
  private reglaDeLinea({ total, partes }: Linea): boolean {
    const ocultas = partes.filter((p) => this.oculta(p));
    if (ocultas.length === 0 && !this.oculta(total)) return false;
    const suma = ocultas.reduce((s, p) => s + this.valor(p), 0);
    if (ocultas.length >= 2 && suma >= this.k) return false;
    const siguiente = this.menorPublicada(partes);
    if (siguiente !== undefined) {
      this.ocultar(siguiente);
      return true;
    }
    if (!this.oculta(total)) {
      this.ocultar(total);
      return true;
    }
    return false;
  }

  private aplicarReglasDeLinea(): void {
    let cambio = true;
    while (cambio) {
      cambio = false;
      for (const linea of this.lineas) {
        while (this.reglaDeLinea(linea)) cambio = true;
      }
    }
  }

  private atacante: typeof acotarPorIntervalos = acotarRapido;

  private cumpleAncho(id: string): boolean {
    const cota = this.atacante(this.vista, this.red.lineas, this.k).get(id);
    return cota !== undefined && cota.max - cota.min >= anchoMinimo(this.k);
  }

  /** Oculta `id` si con eso la celda `objetivo` queda protegida; si no, lo deshace. */
  private probar(id: string, objetivo: string): boolean {
    const previa = this.vista.get(id);
    if (!previa) return false;
    this.ocultar(id);
    if (this.cumpleAncho(objetivo)) return true;
    this.vista.set(id, previa);
    return false;
  }

  /**
   * Ensancha la cota de `inicio` con la acción más barata que de verdad funcione. Ocultar a ciegas la
   * siguiente celda vaciaría la tabla cuando la fuga no viene de una resta. Hay una que ocultar no
   * corrige: el atacante cuenta partes positivas contra el tope de "menor_a_k" (1 + 1 + 1 + 1 bajo un
   * total < 5). Ahí se retira el motivo. Si en sus líneas no queda opción, se buscan en las vecinas.
   */
  private reforzar(inicio: string): void {
    const visitadas = new Set([inicio]);
    const sinMotivo = new Set<string>();
    const cruces = new Set<string>();
    const totales = new Set<string>();
    const porValor = (ids: Iterable<string>): string[] =>
      [...ids].sort((a, b) => this.valor(a) - this.valor(b));
    // Un total aparece en muchas líneas y ocultarlo arrastra a más celdas, así que antes de tocar uno
    // cercano se prueban las celdas de cruce de hasta PROFUNDIDAD_REFUERZO saltos.
    const esTotal = (id: string): boolean =>
      (this.lineasDe.get(id) ?? []).some((l) => l.total === id);

    let frontera = [inicio];
    for (let saltos = 0; frontera.length > 0; saltos += 1) {
      const siguienteFrontera: string[] = [];
      for (const id of frontera) {
        for (const linea of this.lineasDe.get(id) ?? []) {
          if (esLineaAbierta(this.vista, linea)) {
            for (const c of [linea.total, ...linea.partes]) {
              if (this.vista.get(c)?.motivo === "menor_a_k") sinMotivo.add(c);
            }
          }
          const parte = this.menorPublicada(linea.partes);
          const opcion = parte ?? (this.oculta(linea.total) ? undefined : linea.total);
          if (opcion !== undefined) (esTotal(opcion) ? totales : cruces).add(opcion);
          for (const vecina of [linea.total, ...linea.partes]) {
            if (this.oculta(vecina) && !visitadas.has(vecina)) {
              visitadas.add(vecina);
              siguienteFrontera.push(vecina);
            }
          }
        }
      }
      const hayOpciones = sinMotivo.size + cruces.size + totales.size > 0;
      if (hayOpciones && saltos >= PROFUNDIDAD_REFUERZO) break;
      frontera = siguienteFrontera;
    }

    const ordenados = [
      ...sinMotivo,
      ...porValor(cruces).slice(0, MAX_OPCIONES_PROBADAS),
      ...porValor(totales),
    ];
    if (ordenados.some((id) => this.probar(id, inicio))) return;
    // Ninguna basta por sí sola: se avanza con la menos dañina y la siguiente ronda continúa.
    const parcial = ordenados[0];
    if (parcial === undefined) throw new Error(`No se pudo proteger la celda ${inicio}`);
    this.ocultar(parcial);
  }

  private celdasSinAncho(): string[] {
    const minimo = anchoMinimo(this.k);
    const cotas = this.atacante(this.vista, this.red.lineas, this.k);
    return [...this.vista]
      .filter(([id, celda]) => {
        if (celda.conteo !== null) return false;
        const cota = cotas.get(id);
        return cota !== undefined && cota.max - cota.min < minimo;
      })
      .map(([id]) => id);
  }

  proteger(): Map<string, CeldaVista> {
    // El atacante completo es más lento: solo revisa lo que el rápido ya no logra romper.
    for (;;) {
      this.aplicarReglasDeLinea();
      this.atacante = acotarRapido;
      const [falla] = this.celdasSinAncho();
      if (falla !== undefined) {
        this.reforzar(falla);
        continue;
      }
      this.atacante = acotarPorIntervalos;
      const [fallaFina] = this.celdasSinAncho();
      if (fallaFina === undefined) return this.vista;
      this.reforzar(fallaFina);
    }
  }
}

/** Aplica k-anonimato a toda la red. Falla en lugar de publicar algo que no pasó la auditoría. */
export const protegerRed = (red: RedConteos, { k }: ParametrosK): Map<string, CeldaVista> => {
  validar(red, k);
  return new Protector(red, k).proteger();
};

const idCelda = (fila: string, columna: string): string => `f:${fila}|c:${columna}`;
const idFila = (fila: string): string => `f:${fila}`;
const idColumna = (columna: string): string => `c:${columna}`;
const ID_TOTAL = "total";

/** Una tabla de dos dimensiones con sus márgenes y total, como red de líneas. */
export const redDeCubo = ({ filas, columnas, conteos }: CuboConteos): RedConteos => {
  const mapa = new Map<string, number>();
  const lineas: Linea[] = [];
  let total = 0;
  const porColumna = new Map(columnas.map((c) => [c, 0]));
  filas.forEach((fila, i) => {
    let suma = 0;
    columnas.forEach((columna, j) => {
      const n = conteos[i]?.[j] ?? 0;
      mapa.set(idCelda(fila, columna), n);
      suma += n;
      porColumna.set(columna, (porColumna.get(columna) ?? 0) + n);
    });
    mapa.set(idFila(fila), suma);
    total += suma;
    lineas.push({ total: idFila(fila), partes: columnas.map((c) => idCelda(fila, c)) });
  });
  for (const columna of columnas) {
    mapa.set(idColumna(columna), porColumna.get(columna) ?? 0);
    lineas.push({ total: idColumna(columna), partes: filas.map((f) => idCelda(f, columna)) });
  }
  mapa.set(ID_TOTAL, total);
  lineas.push({ total: ID_TOTAL, partes: filas.map(idFila) });
  lineas.push({ total: ID_TOTAL, partes: columnas.map(idColumna) });
  return { conteos: mapa, lineas };
};

export interface ResultadoCubo {
  celdas: CeldaVista[][];
  totalesFila: CeldaVista[];
  totalesColumna: CeldaVista[];
  total: CeldaVista;
}

/** Versión para una sola tabla de dos dimensiones con sus márgenes. */
export const aplicarKAnonimato = (cubo: CuboConteos, parametros: ParametrosK): ResultadoCubo => {
  const vista = protegerRed(redDeCubo(cubo), parametros);
  const leer = (id: string): CeldaVista => {
    const celda = vista.get(id);
    if (!celda) throw new Error(`Celda inexistente: ${id}`);
    return celda;
  };
  return {
    celdas: cubo.filas.map((f) => cubo.columnas.map((c) => leer(idCelda(f, c)))),
    totalesFila: cubo.filas.map((f) => leer(idFila(f))),
    totalesColumna: cubo.columnas.map((c) => leer(idColumna(c))),
    total: leer(ID_TOTAL),
  };
};
