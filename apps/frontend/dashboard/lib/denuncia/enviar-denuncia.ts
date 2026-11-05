import { aBase64Url, solicitudDenuncia } from "@dataton/shared";
import type { PuertoBuzon, PuertoTrabajo, Sellar } from "./puertos";
import { armarRelato } from "./relato";
import type { Hechos, Persona } from "./validaciones";

export type EtapaEnvio = "sellando" | "derivando" | "verificando" | "enviando";

export const DESCRIPCION_ETAPA_ENVIO: Record<EtapaEnvio, string> = {
  sellando: "Sellando tu relato en este dispositivo…",
  derivando: "Preparando tu acceso a partir de tu frase…",
  verificando: "Haciendo una verificación automática. Puede tardar unos segundos…",
  enviando: "Enviando tu denuncia…",
};

export interface EntradaDenuncia {
  hechos: Hechos;
  personas: Persona[];
  frase: string;
  evidenciaIds: string[];
}

export interface DependenciasDenuncia {
  buzon: Pick<PuertoBuzon, "obtenerConfiguracion" | "crearDenuncia">;
  trabajo: PuertoTrabajo;
  sellar: Sellar;
}

/** Sellado local, derivación del acceso y prueba de trabajo. Devuelve el folio. */
export const enviarDenuncia = async (
  { hechos, personas, frase, evidenciaIds }: EntradaDenuncia,
  { buzon, trabajo, sellar }: DependenciasDenuncia,
  informar: (etapa: EtapaEnvio) => void = () => {},
): Promise<string> => {
  informar("sellando");
  const { clavePublicaAutoridad } = await buzon.obtenerConfiguracion();
  const texto = new TextEncoder().encode(
    armarRelato({ relato: hechos.relato, personas, cuando: hechos.cuando }),
  );
  const relatoSellado = aBase64Url(await sellar(clavePublicaAutoridad, texto));

  informar("derivando");
  const accesoId = await trabajo.derivarAccesoId(frase);

  informar("verificando");
  const pow = await trabajo.resolverPow();

  const solicitud = solicitudDenuncia.parse({
    pow,
    accesoId,
    estado: hechos.estado,
    tipoFalta: hechos.tipoFalta,
    relatoSellado,
    evidenciaIds,
    ...(hechos.municipio ? { municipio: hechos.municipio } : {}),
    ...(hechos.enteId ? { enteId: hechos.enteId } : {}),
  });

  informar("enviando");
  const { folio } = await buzon.crearDenuncia(solicitud);
  return folio;
};
