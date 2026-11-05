import type { Hechos, Persona } from "./validaciones";

export const CLAVE_BORRADOR = "buzon:borrador";

export interface Borrador {
  hechos: Hechos;
  personas: Persona[];
}

export type AlmacenBorrador = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const texto = (valor: unknown): string => (typeof valor === "string" ? valor : "");

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null;

/** Lista blanca: solo estos campos pueden llegar al disco. La frase y el folio nunca pasan por aquí. */
const depurar = (datos: Borrador): Borrador => ({
  hechos: {
    estado: datos.hechos.estado,
    municipio: datos.hechos.municipio,
    tipoFalta: datos.hechos.tipoFalta,
    enteId: datos.hechos.enteId,
    cuando: datos.hechos.cuando,
    relato: datos.hechos.relato,
  },
  personas: datos.personas.map((p) => ({ nombre: p.nombre, cargo: p.cargo })),
});

const interpretar = (crudo: string): Borrador | null => {
  const datos: unknown = JSON.parse(crudo);
  if (!esObjeto(datos) || !esObjeto(datos.hechos) || !Array.isArray(datos.personas)) return null;
  const { hechos } = datos;
  return {
    hechos: {
      estado: texto(hechos.estado),
      municipio: texto(hechos.municipio),
      tipoFalta: texto(hechos.tipoFalta),
      enteId: texto(hechos.enteId),
      cuando: texto(hechos.cuando),
      relato: texto(hechos.relato),
    },
    personas: datos.personas
      .filter(esObjeto)
      .map((p) => ({ nombre: texto(p.nombre), cargo: texto(p.cargo) })),
  };
};

export const guardarBorrador = (almacen: AlmacenBorrador, datos: Borrador): boolean => {
  try {
    almacen.setItem(CLAVE_BORRADOR, JSON.stringify(depurar(datos)));
    return true;
  } catch {
    return false;
  }
};

export const borrarBorrador = (almacen: AlmacenBorrador): void => {
  try {
    almacen.removeItem(CLAVE_BORRADOR);
  } catch {
    // Almacenamiento bloqueado: no hay nada que borrar.
  }
};

export const leerBorrador = (almacen: AlmacenBorrador): Borrador | null => {
  try {
    const crudo = almacen.getItem(CLAVE_BORRADOR);
    if (crudo === null) return null;
    const borrador = interpretar(crudo);
    if (borrador === null) borrarBorrador(almacen);
    return borrador;
  } catch {
    borrarBorrador(almacen);
    return null;
  }
};
