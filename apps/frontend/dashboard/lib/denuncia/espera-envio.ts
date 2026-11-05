/** Lo que se le dice a la persona mientras su dispositivo trabaja. Sin red, DOM ni React. */
export const ETAPAS_ENVIO = ["sellando", "derivando", "verificando", "enviando"] as const;
export type EtapaEnvio = (typeof ETAPAS_ENVIO)[number];

const DESCRIPCION_ETAPA: Record<EtapaEnvio, string> = {
  sellando: "Sellando tu relato en este dispositivo…",
  derivando: "Preparando tu acceso a partir de tu frase…",
  verificando: "Haciendo una verificación automática. Puede tardar unos segundos…",
  enviando: "Enviando tu denuncia…",
};

/** Solo dos umbrales: el aviso va en role="status" y cada cambio se lee en voz alta. */
const SEGUNDOS_ESPERA_LARGA = 15;
const SEGUNDOS_ESPERA_MUY_LARGA = 45;

const AVISO_ESPERA_LARGA = "Sigue trabajando; no cierres esta página.";
const AVISO_ESPERA_MUY_LARGA =
  "Tarda más en dispositivos lentos o con mala señal. Sigue trabajando; no cierres esta página.";

const avisoPorTiempo = (segundos: number): string => {
  if (segundos >= SEGUNDOS_ESPERA_MUY_LARGA) return ` ${AVISO_ESPERA_MUY_LARGA}`;
  if (segundos >= SEGUNDOS_ESPERA_LARGA) return ` ${AVISO_ESPERA_LARGA}`;
  return "";
};

export const progresoEnvio = (etapa: EtapaEnvio): { actual: number; total: number } => ({
  actual: ETAPAS_ENVIO.indexOf(etapa) + 1,
  total: ETAPAS_ENVIO.length,
});

/** `segundos` cuenta desde que la persona pulsó enviar. */
export const mensajeEsperaEnvio = (etapa: EtapaEnvio, segundos: number): string =>
  `${DESCRIPCION_ETAPA[etapa]}${avisoPorTiempo(segundos)}`;

export const mensajeEsperaConsulta = (segundos: number): string =>
  `Comprobando. Puede tardar unos segundos…${avisoPorTiempo(segundos)}`;
