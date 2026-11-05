import type { Reloj } from "../../../compartido/aplicacion/puertos.js";
import { diaAnterior, diaDe } from "../../../compartido/dominio/dia.js";
import type { RepositorioEvidencias } from "./puertos.js";

export class LimpiarEvidenciasHuerfanas {
  constructor(
    private readonly puertos: {
      repositorio: Pick<RepositorioEvidencias, "eliminarSinDenunciaAntesDe">;
      reloj: Reloj;
    },
  ) {}

  /**
   * Sin hora de subida solo se puede razonar por día: se conserva también el día anterior
   * para no borrar lo subido justo antes de medianoche por alguien que sigue en el formulario.
   */
  ejecutar(): Promise<number> {
    const { repositorio, reloj } = this.puertos;
    return repositorio.eliminarSinDenunciaAntesDe(diaAnterior(diaDe(reloj.ahora())));
  }
}
