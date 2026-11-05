import { createHmac } from "node:crypto";
import type { Huellas } from "../../contextos/denuncias/aplicacion/puertos.js";

/** D1/D2: la pimienta vive fuera de la base de datos, así un volcado no permite probar credenciales. */
export class HuellasHmac implements Huellas {
  private readonly pimienta: Buffer;

  constructor(pimientaHex: string) {
    this.pimienta = Buffer.from(pimientaHex, "hex");
  }

  huella(valor: string): Uint8Array {
    return new Uint8Array(createHmac("sha256", this.pimienta).update(valor, "utf8").digest());
  }
}
