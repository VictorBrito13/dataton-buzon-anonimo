import type { webcrypto } from "node:crypto";
import { sellar } from "@dataton/shared";
import type { SelladorEvidencias } from "../aplicacion/puertos.js";

/** D3: una vez sellada, el servidor ya no puede abrir la evidencia. */
export class SelladorClavePublica implements SelladorEvidencias {
  constructor(private readonly clavePublica: webcrypto.JsonWebKey) {}

  sellar(bytes: Uint8Array): Promise<Uint8Array> {
    return sellar(this.clavePublica, new Uint8Array(bytes));
  }
}
