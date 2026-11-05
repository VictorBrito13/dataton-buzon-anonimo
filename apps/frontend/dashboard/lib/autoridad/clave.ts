import "@dataton/shared"; // Configura Zod sin eval antes de crear esquemas.
import { z } from "zod";

export type MotivoClave = "demasiado_grande" | "formato" | "es_publica" | "invalida";

/** Los mensajes son fijos: nunca incluyen contenido del archivo, que es material secreto. */
const MENSAJES: Record<MotivoClave, string> = {
  demasiado_grande: "El archivo es demasiado grande para ser una clave JWK.",
  formato: "El archivo no es una clave JWK de tipo EC P-256.",
  es_publica: "Este archivo es la clave pública. Para abrir los sellos se necesita la privada.",
  invalida: "La clave está dañada o este navegador no pudo usarla.",
};

export class ErrorClave extends Error {
  constructor(readonly motivo: MotivoClave) {
    super(MENSAJES[motivo]);
  }
}

const MAX_BYTES_JWK = 16 * 1024;

/** Al parsear se descartan key_ops y ext, que harían fallar la importación en `abrir`. */
const esquemaJwk = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string(),
  y: z.string(),
  d: z.string().optional(),
});

const leerJson = (texto: string): unknown => {
  try {
    // Sin el BOM que agregan algunos editores y PowerShell al guardar como UTF-8.
    return JSON.parse(texto.replace(/^﻿/, "").trim());
  } catch {
    throw new ErrorClave("formato");
  }
};

export const interpretarClavePrivada = async (texto: string): Promise<JsonWebKey> => {
  const jwk = esquemaJwk.safeParse(leerJson(texto));
  if (!jwk.success) throw new ErrorClave("formato");
  if (!jwk.data.d) throw new ErrorClave("es_publica");
  try {
    await crypto.subtle.importKey("jwk", jwk.data, { name: "ECDH", namedCurve: "P-256" }, false, [
      "deriveBits",
    ]);
  } catch {
    throw new ErrorClave("invalida");
  }
  return jwk.data;
};

export type BovedaDeClave = {
  clave: () => JsonWebKey | null;
  cargar: (archivo: File) => Promise<void>;
  olvidar: () => void;
  suscribir: (aviso: () => void) => () => void;
};

/**
 * La clave privada vive solo en este cierre, en la memoria de la pestaña. No hay
 * ningún camino hacia localStorage, cookies ni red: recargar la página la pierde.
 */
export const crearBovedaDeClave = (): BovedaDeClave => {
  let actual: JsonWebKey | null = null;
  const avisos = new Set<() => void>();
  const reemplazar = (clave: JsonWebKey | null) => {
    actual = clave;
    avisos.forEach((aviso) => aviso());
  };

  return {
    clave: () => actual,
    cargar: async (archivo) => {
      if (archivo.size > MAX_BYTES_JWK) throw new ErrorClave("demasiado_grande");
      reemplazar(await interpretarClavePrivada(await archivo.text()));
    },
    olvidar: () => reemplazar(null),
    suscribir: (aviso) => {
      avisos.add(aviso);
      return () => avisos.delete(aviso);
    },
  };
};
