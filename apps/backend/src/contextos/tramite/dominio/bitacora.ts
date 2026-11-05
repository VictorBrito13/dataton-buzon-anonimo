import type { Etapa } from "@dataton/shared";

/** La bitácora rinde cuentas sobre el personal: registra quién hizo qué, nunca contenido. */
export const accionBitacora = {
  sesionIniciada: "sesion_iniciada",
  sesionCerrada: "sesion_cerrada",
  denunciasListadas: "denuncias_listadas",
  denunciaConsultada: "denuncia_consultada",
  mensajeEnviado: "mensaje_enviado",
  evidenciaDescargada: "evidencia_descargada",
  etapaCambiada: (etapa: Etapa): string => `etapa_cambiada:${etapa}`,
  etapaRechazada: (etapa: Etapa): string => `etapa_rechazada:${etapa}`,
} as const;
