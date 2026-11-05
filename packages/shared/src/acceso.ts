import { argon2id } from "hash-wasm";
import { normalizarFrase } from "./normalizar.js";

/** Sal fija por versión: la derivación debe ser determinista para poder buscar por frase. */
const SAL_ACCESO = "buzon-anonimo/acceso/v1";

/** Parámetros mínimos de OWASP para Argon2id, viables en celulares de gama baja. */
const ARGON2 = { parallelism: 1, iterations: 2, memorySize: 19_456, hashLength: 32 } as const;

/**
 * Deriva en el dispositivo el identificador que sí viaja al servidor. La frase
 * nunca sale del navegador. Devuelve 32 bytes en hexadecimal.
 */
export const derivarAccesoId = (frase: string): Promise<string> =>
  argon2id({
    ...ARGON2,
    password: normalizarFrase(frase),
    salt: new TextEncoder().encode(SAL_ACCESO),
    outputType: "hex",
  });
