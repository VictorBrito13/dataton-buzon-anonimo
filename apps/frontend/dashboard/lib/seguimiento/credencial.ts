import {
  ERROR_ACCESO,
  esquemaFolio,
  fraseValida,
  normalizarFrase,
  type Credencial,
} from "@dataton/shared";

export type EntradaCredencial = { tipo: "folio" | "frase"; valor: string };

/** Mismo texto para cualquier falla de acceso: no revela qué dato estaba mal ni si existe. */
export class ErrorAcceso extends Error {
  constructor() {
    super(ERROR_ACCESO.error.message);
  }
}

/** Tolera lo que pasa al copiar a mano: minúsculas, sin guiones, y O/I/L en vez de 0/1. */
export const normalizarFolio = (valor: string): string => {
  const limpio = valor
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^BZ/, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return `BZ-${limpio.match(/.{1,4}/g)?.join("-") ?? ""}`;
};

export const prepararCredencial = async (
  { tipo, valor }: EntradaCredencial,
  derivar: (frase: string) => Promise<string>,
): Promise<Credencial> => {
  if (tipo === "folio") {
    const folio = normalizarFolio(valor);
    if (!esquemaFolio.safeParse(folio).success) throw new ErrorAcceso();
    return { tipo: "folio", folio };
  }
  if (!fraseValida(valor)) throw new ErrorAcceso();
  return { tipo: "frase", accesoId: await derivar(normalizarFrase(valor)) };
};
