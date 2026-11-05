import type { TipoFalta } from "@dataton/shared";
import type { Reloj, VerificadorPow } from "../../../compartido/aplicacion/puertos.js";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import { exigirTotalEvidencias, nuevaDenuncia } from "../dominio/denuncia.js";
import { BYTES_FOLIO, folioDesdeBytes } from "../dominio/folio.js";
import type { AzarSeguro, Huellas, RepositorioDenuncias } from "./puertos.js";

export interface SolicitudCrearDenuncia {
  pow: string;
  accesoId: string;
  estado: string;
  municipio?: string | undefined;
  tipoFalta: TipoFalta;
  enteId?: string | undefined;
  relatoSellado: Uint8Array;
  evidenciaIds: readonly string[];
}

export class CrearDenuncia {
  constructor(
    private readonly puertos: {
      repositorio: RepositorioDenuncias;
      huellas: Huellas;
      reloj: Reloj;
      pow: VerificadorPow;
      azar: AzarSeguro;
    },
    private readonly maxBytesTotal: number,
  ) {}

  /** El folio solo existe en esta respuesta: se guarda únicamente su huella. */
  async ejecutar(solicitud: SolicitudCrearDenuncia): Promise<{ folio: string }> {
    const { repositorio, huellas, reloj, pow, azar } = this.puertos;
    if (!(await pow.consumir(solicitud.pow))) {
      throw new ErrorDominio("pow_invalida", "La verificación expiró. Inténtalo de nuevo.");
    }
    const denuncia = nuevaDenuncia(solicitud, reloj.ahora());
    exigirTotalEvidencias(
      await repositorio.tamanosEvidencias(denuncia.evidenciaIds),
      this.maxBytesTotal,
    );

    const folio = folioDesdeBytes(azar.bytes(BYTES_FOLIO));
    const resultado = await repositorio.crear(denuncia, {
      folio: huellas.huella(folio),
      acceso: huellas.huella(solicitud.accesoId),
    });
    if (resultado === "acceso_duplicado") {
      throw new ErrorDominio(
        "acceso_duplicado",
        "No pudimos registrar la denuncia con esta frase.",
      );
    }
    if (resultado === "evidencia_invalida") {
      throw new ErrorDominio("evidencia_invalida", "Alguna evidencia ya no está disponible.");
    }
    return { folio };
  }
}
