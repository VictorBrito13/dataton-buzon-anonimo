/** Una sola zona para todo el sistema; se cambia con ZONA_HORARIA. */
export const ZONA_HORARIA_POR_DEFECTO = "America/Mexico_City";

export const zonaHorariaValida = (zona: string): boolean => {
  if (!zona) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
};

/**
 * Los datos ligados a una denuncia solo guardan el día: nunca la hora (convención de D-Datos).
 * El día es el de la zona indicada, para que coincida con el que vivió quien denuncia.
 */
export const diaDe = (instante: Date, zona: string): string => {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instante);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value as string;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
};

/** Aritmética de calendario sobre una fecha ya redondeada: no intervienen zonas. */
export const diaAnterior = (dia: string): string =>
  new Date(Date.parse(`${dia}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
