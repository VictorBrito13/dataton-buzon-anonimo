import type { Credencial } from "@dataton/shared";
import type { Reloj, VerificadorPow } from "../../../compartido/aplicacion/puertos.js";
import type { LimiteIntentos } from "../../../compartido/dominio/limite-intentos.js";
import type { Huellas, RepositorioDenuncias, ViaAcceso } from "./puertos.js";

export interface AbridorAcceso {
  abrir(pow: string, credencial: Credencial): Promise<string | null>;
}

const CLAVE_GLOBAL = "global";

/**
 * Punto único de acceso sin cuenta. Cualquier fallo es `null`: quien llama no puede distinguir
 * prueba de trabajo inválida, límite excedido o credencial inexistente, y el exterior tampoco.
 * Se cuentan también los aciertos, para frenar el abuso de una credencial filtrada.
 */
export class PuertaAcceso implements AbridorAcceso {
  constructor(
    private readonly puertos: {
      repositorio: Pick<RepositorioDenuncias, "buscarId">;
      huellas: Huellas;
      reloj: Reloj;
      pow: VerificadorPow;
      limiteCredencial: LimiteIntentos;
      limiteGlobal: LimiteIntentos;
    },
  ) {}

  async abrir(pow: string, credencial: Credencial): Promise<string | null> {
    const { repositorio, huellas, reloj, limiteCredencial, limiteGlobal } = this.puertos;
    if (!(await this.puertos.pow.consumir(pow))) return null;

    const ahoraMs = reloj.ahora().getTime();
    const via: ViaAcceso = credencial.tipo === "folio" ? "folio" : "acceso";
    const huella = huellas.huella(
      credencial.tipo === "folio" ? credencial.folio : credencial.accesoId,
    );
    if (!limiteGlobal.permitir(CLAVE_GLOBAL, ahoraMs)) return null;
    if (!limiteCredencial.permitir(Buffer.from(huella).toString("hex"), ahoraMs)) return null;

    return repositorio.buscarId(via, huella);
  }
}
