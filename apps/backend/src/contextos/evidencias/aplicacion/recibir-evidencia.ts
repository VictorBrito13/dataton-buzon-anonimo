import type { RespuestaEvidencia } from "@dataton/shared";
import type { Reloj } from "../../../compartido/aplicacion/puertos.js";
import { diaDe } from "../../../compartido/dominio/dia.js";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import {
  categoriaDe,
  exigirCuotaHuerfanas,
  exigirSinResiduales,
  exigirTamano,
  type UsoHuerfanas,
} from "../dominio/politica.js";
import type {
  DetectorTipo,
  Limpiador,
  RepositorioEvidencias,
  SelladorEvidencias,
} from "./puertos.js";

export interface LimitesRecepcion {
  maxBytes: number;
  /** Cuota global de subidas sin denuncia; al alcanzarla no se limpia ni se guarda nada más. */
  cuotaHuerfanas: UsoHuerfanas;
}

export class RecibirEvidencia {
  constructor(
    private readonly puertos: {
      detector: DetectorTipo;
      limpiador: Limpiador;
      sellador: SelladorEvidencias;
      repositorio: RepositorioEvidencias;
      reloj: Reloj;
    },
    private readonly limites: LimitesRecepcion,
  ) {}

  /** El original solo vive en memoria durante esta llamada: lo que se guarda es el sello. */
  async ejecutar(bytes: Uint8Array): Promise<RespuestaEvidencia> {
    const { detector, limpiador, sellador, repositorio, reloj } = this.puertos;
    exigirTamano(bytes.length, this.limites.maxBytes);
    // Antes de gastar CPU en limpiar: con la cuota agotada no hay nada que hacer con el archivo.
    exigirCuotaHuerfanas(await repositorio.usoHuerfanas(), this.limites.cuotaHuerfanas);

    const tipo = await detector.detectar(bytes);
    const categoria = tipo ? categoriaDe(tipo) : null;
    if (!tipo || !categoria) {
      throw new ErrorDominio("tipo_no_permitido", "Este tipo de archivo no se admite.");
    }

    const limpio = await limpiador.limpiar(tipo, categoria, bytes);
    exigirSinResiduales(limpio.residuales);

    const evidenciaId = await repositorio.guardar({
      tipo,
      blobSellado: await sellador.sellar(limpio.bytes),
      subidaDia: diaDe(reloj.ahora()),
    });
    return { evidenciaId, metadatosEliminadosEnServidor: limpio.eliminados };
  }
}
