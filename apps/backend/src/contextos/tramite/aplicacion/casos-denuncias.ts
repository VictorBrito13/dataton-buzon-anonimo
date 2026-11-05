import type { DetalleDenunciaAutoridad, Etapa, ResumenDenunciaAutoridad } from "@dataton/shared";
import type { CifradorMensajes, Reloj } from "../../../compartido/aplicacion/puertos.js";
import { diaDe } from "../../../compartido/dominio/dia.js";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import { accionBitacora } from "../dominio/bitacora.js";
import { exigirTransicion } from "../dominio/etapa.js";
import type { Sesion } from "../dominio/sesion.js";
import type { EvidenciaParaAutoridad, RepositorioTramite } from "./puertos.js";

const base64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");

const noEncontrada = (): ErrorDominio =>
  new ErrorDominio("denuncia_no_encontrada", "La denuncia no existe.");

/**
 * Toda acción deja rastro en la bitácora antes de entregar datos: si la bitácora falla,
 * la operación también (falla cerrado).
 */
export class CasosDenunciasAutoridad {
  constructor(
    private readonly puertos: {
      repositorio: RepositorioTramite;
      cifrador: CifradorMensajes;
      reloj: Reloj;
    },
  ) {}

  async listar(sesion: Sesion): Promise<ResumenDenunciaAutoridad[]> {
    const { repositorio } = this.puertos;
    const denuncias = await repositorio.listar();
    await repositorio.registrar(sesion.usuarioId, accionBitacora.denunciasListadas, null);
    return denuncias as ResumenDenunciaAutoridad[];
  }

  async ver(sesion: Sesion, id: string): Promise<DetalleDenunciaAutoridad> {
    const { repositorio, cifrador } = this.puertos;
    const detalle = await repositorio.detalle(id);
    if (!detalle) throw noEncontrada();
    await repositorio.registrar(sesion.usuarioId, accionBitacora.denunciaConsultada, id);
    return {
      ...detalle,
      relatoSellado: base64url(detalle.relatoSellado),
      mensajes: detalle.mensajes.map(({ autor, dia, cuerpoCifrado, cuerpoSellado }) => ({
        autor,
        dia,
        cuerpo: cuerpoCifrado ? cifrador.descifrar(cuerpoCifrado, id) : null,
        cuerpoSellado: cuerpoSellado ? base64url(cuerpoSellado) : null,
      })),
    } as DetalleDenunciaAutoridad;
  }

  async cambiarEtapa(sesion: Sesion, id: string, nueva: Etapa): Promise<void> {
    const { repositorio, reloj } = this.puertos;
    try {
      await repositorio.transaccion(async (tx) => {
        const actual = await tx.etapaBloqueada(id);
        if (!actual) throw noEncontrada();
        exigirTransicion(actual, nueva);
        await tx.cambiarEtapa(id, nueva, diaDe(reloj.ahora(), reloj.zona));
        await tx.registrar(sesion.usuarioId, accionBitacora.etapaCambiada(nueva), id);
      });
    } catch (error) {
      if (error instanceof ErrorDominio && error.codigo === "transicion_invalida") {
        await repositorio.registrar(sesion.usuarioId, accionBitacora.etapaRechazada(nueva), id);
      }
      throw error;
    }
  }

  async enviarMensaje(sesion: Sesion, id: string, cuerpo: string): Promise<void> {
    const { repositorio, cifrador, reloj } = this.puertos;
    await repositorio.transaccion(async (tx) => {
      if (!(await tx.etapaBloqueada(id))) throw noEncontrada();
      await tx.agregarMensaje(id, cifrador.cifrar(cuerpo, id), diaDe(reloj.ahora(), reloj.zona));
      await tx.registrar(sesion.usuarioId, accionBitacora.mensajeEnviado, id);
    });
  }

  async descargarEvidencia(
    sesion: Sesion,
    denunciaId: string,
    evidenciaId: string,
  ): Promise<EvidenciaParaAutoridad> {
    const { repositorio } = this.puertos;
    const evidencia = await repositorio.evidencia(denunciaId, evidenciaId);
    if (!evidencia) {
      throw new ErrorDominio("evidencia_no_encontrada", "La evidencia no existe.");
    }
    await repositorio.registrar(sesion.usuarioId, accionBitacora.evidenciaDescargada, denunciaId);
    return evidencia;
  }
}
