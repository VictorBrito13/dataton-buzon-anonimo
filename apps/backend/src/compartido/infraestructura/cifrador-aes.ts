import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { CifradorMensajes } from "../aplicacion/puertos.js";

const LARGO_IV = 12;
const LARGO_ETIQUETA = 16;

/** AES-256-GCM. Formato: iv | etiqueta | cifrado. El contexto va como dato autenticado. */
export class CifradorAes implements CifradorMensajes {
  private readonly clave: Buffer;

  constructor(claveHex: string) {
    this.clave = Buffer.from(claveHex, "hex");
  }

  cifrar(texto: string, contexto: string): Uint8Array {
    const iv = randomBytes(LARGO_IV);
    const cifrador = createCipheriv("aes-256-gcm", this.clave, iv);
    cifrador.setAAD(Buffer.from(contexto, "utf8"));
    const cifrado = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
    return new Uint8Array(Buffer.concat([iv, cifrador.getAuthTag(), cifrado]));
  }

  descifrar(bytes: Uint8Array, contexto: string): string {
    const datos = Buffer.from(bytes);
    const descifrador = createDecipheriv("aes-256-gcm", this.clave, datos.subarray(0, LARGO_IV));
    descifrador.setAAD(Buffer.from(contexto, "utf8"));
    descifrador.setAuthTag(datos.subarray(LARGO_IV, LARGO_IV + LARGO_ETIQUETA));
    return Buffer.concat([
      descifrador.update(datos.subarray(LARGO_IV + LARGO_ETIQUETA)),
      descifrador.final(),
    ]).toString("utf8");
  }
}
