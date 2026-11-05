import type { Credencial } from "@dataton/shared";
import type { Reloj } from "../../../compartido/aplicacion/puertos.js";
import { diaDe } from "../../../compartido/dominio/dia.js";
import { selloBienFormado } from "../../../compartido/dominio/sello.js";
import type { AbridorAcceso } from "./puerta-acceso.js";
import type { RepositorioDenuncias } from "./puertos.js";

export class EnviarMensajeDenunciante {
  constructor(
    private readonly puertos: {
      puerta: AbridorAcceso;
      repositorio: Pick<RepositorioDenuncias, "agregarMensajeDenunciante">;
      reloj: Reloj;
    },
  ) {}

  async ejecutar(pow: string, credencial: Credencial, cuerpoSellado: Uint8Array): Promise<boolean> {
    const { puerta, repositorio, reloj } = this.puertos;
    const id = await puerta.abrir(pow, credencial);
    if (!id || !selloBienFormado(cuerpoSellado)) return false;
    await repositorio.agregarMensajeDenunciante(id, cuerpoSellado, diaDe(reloj.ahora()));
    return true;
  }
}
