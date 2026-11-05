/** Los datos ligados a una denuncia solo guardan el día: nunca la hora (convención de D-Datos). */
export const diaDe = (instante: Date): string => instante.toISOString().slice(0, 10);

export const diaAnterior = (dia: string): string =>
  diaDe(new Date(Date.parse(`${dia}T00:00:00Z`) - 86_400_000));
