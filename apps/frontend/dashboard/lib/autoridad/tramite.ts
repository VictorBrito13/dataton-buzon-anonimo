import { ETAPAS, TRANSICIONES, type Etapa } from "@dataton/shared";

export type OpcionEtapa = { etapa: Etapa; etiqueta: string; concluye: boolean };

/** Lo único que la autoridad puede elegir desde una etapa: la regla es TRANSICIONES. */
export const etapasDisponibles = (actual: Etapa): OpcionEtapa[] =>
  TRANSICIONES[actual].map((etapa) => ({
    etapa,
    etiqueta: ETAPAS[etapa].etiqueta,
    concluye: ETAPAS[etapa].terminal,
  }));

export const admiteCambios = (actual: Etapa): boolean => TRANSICIONES[actual].length > 0;

export const avisoDeConfirmacion = (origen: Etapa, destino: Etapa): string => {
  if (!TRANSICIONES[origen].includes(destino)) {
    throw new Error(`Transición no permitida: ${origen} a ${destino}`);
  }
  const base =
    `La denuncia pasará de «${ETAPAS[origen].etiqueta}» a «${ETAPAS[destino].etiqueta}». ` +
    "El cambio queda en la bitácora, lo verá quien denunció en su seguimiento y no se puede deshacer desde este panel.";
  return ETAPAS[destino].terminal ? `${base} Esta etapa concluye el trámite.` : base;
};
