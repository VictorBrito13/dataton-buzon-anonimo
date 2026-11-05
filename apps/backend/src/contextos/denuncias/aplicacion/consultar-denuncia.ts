import type { Credencial, RespuestaConsulta } from "@dataton/shared";
import type { CifradorMensajes } from "../../../compartido/aplicacion/puertos.js";
import type { AbridorAcceso } from "./puerta-acceso.js";
import type { RepositorioDenuncias } from "./puertos.js";

export class ConsultarDenuncia {
  constructor(
    private readonly puertos: {
      puerta: AbridorAcceso;
      repositorio: Pick<RepositorioDenuncias, "seguimiento">;
      cifrador: CifradorMensajes;
    },
  ) {}

  async ejecutar(pow: string, credencial: Credencial): Promise<RespuestaConsulta | null> {
    const { puerta, repositorio, cifrador } = this.puertos;
    const id = await puerta.abrir(pow, credencial);
    if (!id) return null;
    const { etapaActual, lineaTiempo, mensajes } = await repositorio.seguimiento(id);
    return {
      etapaActual,
      lineaTiempo,
      mensajes: mensajes.map(({ autor, dia, cuerpoCifrado }) => ({
        autor,
        dia,
        cuerpo: cuerpoCifrado ? cifrador.descifrar(cuerpoCifrado, id) : null,
      })),
    };
  }
}
