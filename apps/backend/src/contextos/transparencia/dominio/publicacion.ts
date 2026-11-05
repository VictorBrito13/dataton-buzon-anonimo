import { CLAVES_ESTADO, CLAVES_ETAPA, CLAVES_TIPO_FALTA, DIMENSIONES } from "@dataton/shared";
import type { Dimension } from "@dataton/shared";
import { protegerRed, type Linea, type Motivo, type RedConteos } from "./k-anonimato.js";

/**
 * Plan de publicación de un trimestre: las tablas que salen y cómo se enlazan. Todas forman una sola
 * red, así que un total estatal, sus municipios y sus cruces por tipo se protegen juntos.
 *
 * Municipio × tipo de falta queda fuera a propósito: con pocas denuncias por municipio casi todo saldría
 * oculto y multiplicaría las ecuaciones disponibles para un atacante.
 */
export const TABLAS_PUBLICADAS = [
  "estado",
  "municipio",
  "tipoFalta",
  "etapa",
  "ente",
  "estado,tipoFalta",
  "estado,etapa",
  "tipoFalta,etapa",
  "etapa,ente",
] as const;

export const TABLA_TOTAL = "total";
export const CLAVE_SIN_ENTE = "sin_especificar";
/** Casos sin municipio: se mantienen en el total del estado. */
export const claveMunicipioSinEspecificar = (estado: string): string => `${estado}999`;

export interface DenunciaAgregable {
  estado: string;
  municipio: string | null;
  tipoFalta: string;
  etapa: string;
  ente: string | null;
  n: number;
}

export interface Universo {
  municipios: readonly { clave: string; estado: string }[];
  entes: readonly string[];
}

export interface FilaPublicada {
  /** Identificador interno de la celda; no se publica. */
  id: string;
  dimensiones: string;
  claves: Record<string, string>;
  conteo: number | null;
  motivo: Motivo;
}

export const normalizarDimensiones = (dimensiones: readonly Dimension[]): string => {
  if (dimensiones.length === 0 || dimensiones.length > 2) {
    throw new Error("Se publican como máximo dos dimensiones a la vez");
  }
  if (new Set(dimensiones).size !== dimensiones.length) {
    throw new Error("Dimensiones repetidas");
  }
  return [...dimensiones].sort((a, b) => DIMENSIONES.indexOf(a) - DIMENSIONES.indexOf(b)).join(",");
};

/** Claves en el orden canónico de DIMENSIONES: `{ ente, etapa }` y `{ etapa, ente }` son la misma celda. */
const ordenarClaves = (claves: Readonly<Record<string, string>>): [string, string][] =>
  Object.entries(claves).sort(
    ([a], [b]) =>
      (DIMENSIONES as readonly string[]).indexOf(a) - (DIMENSIONES as readonly string[]).indexOf(b),
  );

/** Identificador interno de una celda a partir de sus claves, sin importar el orden en que se den. */
export const idDeClaves = (claves: Readonly<Record<string, string>>): string =>
  ordenarClaves(claves)
    .map(([d, v]) => `${d}=${v}`)
    .join("|") || TABLA_TOTAL;

class Constructor {
  readonly conteos = new Map<string, number>();
  readonly claves = new Map<string, Record<string, string>>();
  readonly lineas: Linea[] = [];

  registrar(claves: Record<string, string>): string {
    const id = idDeClaves(claves);
    if (!this.conteos.has(id)) {
      this.conteos.set(id, 0);
      this.claves.set(id, Object.fromEntries(ordenarClaves(claves)));
    }
    return id;
  }

  sumar(claves: Record<string, string>, n: number): void {
    const id = this.registrar(claves);
    this.conteos.set(id, (this.conteos.get(id) ?? 0) + n);
  }

  linea(total: Record<string, string>, partes: readonly Record<string, string>[]): void {
    this.lineas.push({
      total: this.registrar(total),
      partes: partes.map((p) => this.registrar(p)),
    });
  }
}

export const construirRedConClaves = (
  denuncias: readonly DenunciaAgregable[],
  universo: Universo,
): Constructor => {
  const c = new Constructor();
  const estadoDe = new Map(universo.municipios.map((m) => [m.clave, m.estado]));
  const entes = [...new Set([...universo.entes, CLAVE_SIN_ENTE])];

  for (const d of denuncias) {
    if (d.municipio !== null && estadoDe.get(d.municipio) !== d.estado) {
      throw new Error(`El municipio ${d.municipio} no pertenece al estado ${d.estado}`);
    }
    const municipio = d.municipio ?? claveMunicipioSinEspecificar(d.estado);
    const ente = d.ente ?? CLAVE_SIN_ENTE;
    const { estado, tipoFalta, etapa, n } = d;
    c.sumar({}, n);
    c.sumar({ estado }, n);
    c.sumar({ municipio }, n);
    c.sumar({ tipoFalta }, n);
    c.sumar({ etapa }, n);
    c.sumar({ ente }, n);
    c.sumar({ estado, tipoFalta }, n);
    c.sumar({ estado, etapa }, n);
    c.sumar({ tipoFalta, etapa }, n);
    c.sumar({ ente, etapa }, n);
  }

  const estados = CLAVES_ESTADO as readonly string[];
  const tipos = CLAVES_TIPO_FALTA as readonly string[];
  const etapas = CLAVES_ETAPA as readonly string[];

  c.linea(
    {},
    estados.map((estado) => ({ estado })),
  );
  c.linea(
    {},
    tipos.map((tipoFalta) => ({ tipoFalta })),
  );
  c.linea(
    {},
    etapas.map((etapa) => ({ etapa })),
  );
  c.linea(
    {},
    entes.map((ente) => ({ ente })),
  );

  for (const estado of estados) {
    const propios = universo.municipios.filter((m) => m.estado === estado).map((m) => m.clave);
    c.linea(
      { estado },
      [...propios, claveMunicipioSinEspecificar(estado)].map((municipio) => ({ municipio })),
    );
    c.linea(
      { estado },
      tipos.map((tipoFalta) => ({ estado, tipoFalta })),
    );
    c.linea(
      { estado },
      etapas.map((etapa) => ({ estado, etapa })),
    );
  }
  for (const tipoFalta of tipos) {
    c.linea(
      { tipoFalta },
      estados.map((estado) => ({ estado, tipoFalta })),
    );
    c.linea(
      { tipoFalta },
      etapas.map((etapa) => ({ tipoFalta, etapa })),
    );
  }
  for (const etapa of etapas) {
    c.linea(
      { etapa },
      estados.map((estado) => ({ estado, etapa })),
    );
    c.linea(
      { etapa },
      tipos.map((tipoFalta) => ({ tipoFalta, etapa })),
    );
    c.linea(
      { etapa },
      entes.map((ente) => ({ ente, etapa })),
    );
  }
  for (const ente of entes) {
    c.linea(
      { ente },
      etapas.map((etapa) => ({ ente, etapa })),
    );
  }
  return c;
};

export const construirRed = (
  denuncias: readonly DenunciaAgregable[],
  universo: Universo,
): RedConteos => {
  const { conteos, lineas } = construirRedConClaves(denuncias, universo);
  return { conteos, lineas };
};

/** El mismo nombre que produce `normalizarDimensiones`: así cada tabla se puede pedir por /agregados. */
const nombreDeTabla = (claves: Readonly<Record<string, string>>): string =>
  ordenarClaves(claves)
    .map(([d]) => d)
    .join(",") || TABLA_TOTAL;

/** Protege todas las tablas de un trimestre. Es la única forma de producir filas publicables. */
export const construirPublicacion = (
  denuncias: readonly DenunciaAgregable[],
  universo: Universo,
  { k }: { k: number },
): FilaPublicada[] => {
  const constructor = construirRedConClaves(denuncias, universo);
  const vista = protegerRed(constructor, { k });
  return [...vista].map(([id, celda]) => {
    const claves = constructor.claves.get(id) ?? {};
    return { id, dimensiones: nombreDeTabla(claves), claves, ...celda };
  });
};
