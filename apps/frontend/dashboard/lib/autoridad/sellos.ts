import { abrir, deBase64Url } from "@dataton/shared";

export type AperturaDeTexto =
  { estado: "sellado" } | { estado: "abierto"; texto: string } | { estado: "no_abre" };

/** Abre en este navegador. No lanza: un sello que no abre es un estado que la autoridad debe ver. */
export const abrirTexto = async (
  clave: JsonWebKey | null,
  selloBase64: string,
): Promise<AperturaDeTexto> => {
  if (!clave) return { estado: "sellado" };
  try {
    const bytes = await abrir(clave, deBase64Url(selloBase64));
    return { estado: "abierto", texto: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { estado: "no_abre" };
  }
};

export type RelatoLegible =
  | { tipo: "texto"; texto: string }
  | { tipo: "campos"; campos: { nombre: string; valor: string }[] };

const valorLegible = (valor: unknown): string => {
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor) && valor.every((v) => typeof v === "string")) return valor.join(", ");
  return JSON.stringify(valor);
};

/** El contrato no fija el formato interno del relato: se aceptan texto libre y objeto JSON. */
export const interpretarRelato = (texto: string): RelatoLegible => {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { tipo: "texto", texto };
  }
  if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
    return { tipo: "texto", texto };
  }
  return {
    tipo: "campos",
    campos: Object.entries(datos).map(([nombre, valor]) => ({
      nombre,
      valor: valorLegible(valor),
    })),
  };
};

export class ErrorSello extends Error {
  constructor() {
    super("La clave cargada no abre esta evidencia o el archivo está dañado.");
  }
}

const EXTENSIONES: Readonly<Record<string, string>> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

export type EvidenciaAbierta = { nombre: string; archivo: Blob };

/**
 * El contenido viene de quien denuncia y no es de fiar: se entrega siempre como
 * descarga binaria, para que nunca se ejecute en el origen del panel (HTML o SVG).
 */
export const abrirEvidencia = async (
  clave: JsonWebKey,
  sello: Uint8Array<ArrayBuffer>,
  evidencia: { id: string; tipo: string },
): Promise<EvidenciaAbierta> => {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await abrir(clave, sello);
  } catch {
    throw new ErrorSello();
  }
  const extension = Object.hasOwn(EXTENSIONES, evidencia.tipo)
    ? EXTENSIONES[evidencia.tipo]
    : "bin";
  return {
    nombre: `evidencia-${evidencia.id.slice(0, 8)}.${extension}`,
    archivo: new Blob([bytes], { type: "application/octet-stream" }),
  };
};
