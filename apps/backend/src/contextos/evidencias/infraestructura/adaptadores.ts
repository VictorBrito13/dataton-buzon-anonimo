import type { webcrypto } from "node:crypto";
import { sellar } from "@dataton/shared";
import type { Limpiador, ResultadoLimpieza, SelladorEvidencias } from "../aplicacion/puertos.js";
import type { CategoriaEvidencia } from "../dominio/politica.js";
import { limpiarImagen } from "./limpiador-imagen.js";
import { limpiarOffice } from "./limpiador-office.js";
import { limpiarPdf } from "./limpiador-pdf.js";

export class LimpiadorEvidencias implements Limpiador {
  limpiar(
    tipo: string,
    categoria: CategoriaEvidencia,
    bytes: Uint8Array,
  ): Promise<ResultadoLimpieza> {
    if (categoria === "imagen") return limpiarImagen(tipo, bytes);
    if (categoria === "pdf") return limpiarPdf(bytes);
    return limpiarOffice(bytes);
  }
}

/** D3: una vez sellada, el servidor ya no puede abrir la evidencia. */
export class SelladorClavePublica implements SelladorEvidencias {
  constructor(private readonly clavePublica: webcrypto.JsonWebKey) {}

  sellar(bytes: Uint8Array): Promise<Uint8Array> {
    return sellar(this.clavePublica, new Uint8Array(bytes));
  }
}
