import type { TipoFalta } from "@dataton/shared";
import type { Reloj, VerificadorPow } from "../../../compartido/aplicacion/puertos.js";
import { ErrorDominio } from "../../../compartido/dominio/errores.js";
import type { LimiteIntentos } from "../../../compartido/dominio/limite-intentos.js";
import { exigirTotalEvidencias, nuevaDenuncia } from "../dominio/denuncia.js";
import { BYTES_FOLIO, folioDesdeBytes } from "../dominio/folio.js";
import type { AzarSeguro, Huellas, RepositorioDenuncias } from "./puertos.js";

const CLAVE_GLOBAL = "global";

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
      /** Por huella de la frase y global: el 409 de frase repetida no se puede sondear a voluntad. */
      limiteCredencial: LimiteIntentos;
      limiteGlobal: LimiteIntentos;
    },
    private readonly maxBytesTotal: number,
  ) {}

  /** El folio solo existe en esta respuesta: se guarda únicamente su huella. */
  async ejecutar(solicitud: SolicitudCrearDenuncia): Promise<{ folio: string }> {
    const { repositorio, huellas, reloj, pow, azar, limiteCredencial, limiteGlobal } = this.puertos;
    if (!(await pow.consumir(solicitud.pow))) {
      throw new ErrorDominio("pow_invalida", "La verificación expiró. Inténtalo de nuevo.");
    }
    const ahoraMs = reloj.ahora().getTime();
    const acceso = huellas.huella(solicitud.accesoId);
    if (
      !limiteGlobal.permitir(CLAVE_GLOBAL, ahoraMs) ||
      !limiteCredencial.permitir(Buffer.from(acceso).toString("hex"), ahoraMs)
    ) {
      throw new ErrorDominio("demasiados_intentos", "Demasiados intentos. Espera unos minutos.");
    }
    const denuncia = nuevaDenuncia(solicitud, reloj.ahora(), reloj.zona);
    exigirTotalEvidencias(
      await repositorio.tamanosEvidencias(denuncia.evidenciaIds),
      this.maxBytesTotal,
    );

    const folio = folioDesdeBytes(azar.bytes(BYTES_FOLIO));
    const resultado = await repositorio.crear(denuncia, { folio: huellas.huella(folio), acceso });
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
