/**
 * Cortes por trimestre cerrado (D6, regla 5). No existe un periodo acumulado ni móvil: cada denuncia
 * cae en un solo trimestre, y por eso restar dos publicaciones no aísla ningún caso nuevo.
 */
const FORMATO = /^(\d{4})-T([1-4])$/;

const partes = (periodo: string): { anio: number; trimestre: number } => {
  const m = FORMATO.exec(periodo);
  if (!m) throw new Error(`Periodo inválido: ${periodo}. Se esperaba un trimestre como 2026-T3`);
  return { anio: Number(m[1]), trimestre: Number(m[2]) };
};

const dia = (fecha: Date): string => fecha.toISOString().slice(0, 10);

export const inicioDePeriodo = (periodo: string): string => {
  const { anio, trimestre } = partes(periodo);
  return dia(new Date(Date.UTC(anio, (trimestre - 1) * 3, 1)));
};

export const finDePeriodo = (periodo: string): string => {
  const { anio, trimestre } = partes(periodo);
  return dia(new Date(Date.UTC(anio, trimestre * 3, 0)));
};

export const periodoDeDia = (fecha: string): string => {
  const mes = Number(fecha.slice(5, 7));
  return `${fecha.slice(0, 4)}-T${Math.ceil(mes / 3)}`;
};

/** Publicable solo si cerró y además pasó el rezago, para no ligar un caso a un hecho reciente. */
export const esPublicable = (periodo: string, hoy: string, rezagoDias: number): boolean => {
  const fin = new Date(`${finDePeriodo(periodo)}T00:00:00Z`);
  fin.setUTCDate(fin.getUTCDate() + rezagoDias);
  return dia(fin) < hoy;
};

const siguiente = (periodo: string): string => {
  const { anio, trimestre } = partes(periodo);
  return trimestre === 4 ? `${anio + 1}-T1` : `${anio}-T${trimestre + 1}`;
};

export const periodosPublicables = (desde: string, hoy: string, rezagoDias: number): string[] => {
  const lista: string[] = [];
  for (let p = desde; esPublicable(p, hoy, rezagoDias); p = siguiente(p)) lista.push(p);
  return lista;
};
