import {
  DETALLE_SISTEMAS,
  SISTEMAS_COBERTURA,
  type FilaCobertura,
  type SistemaCobertura,
} from "@dataton/shared";
import { formatoNumero } from "./celdas";

export const SISTEMA_INICIAL: SistemaCobertura = "s3";
/** Con menos registros, un porcentaje dice poco: Tlaxcala, por ejemplo, solo tiene uno para S3. */
export const UMBRAL_DENOMINADOR_BAJO = 10;
const MAX_BRECHAS = 5;
const CLAVE_FEDERACION = "00";

export type Conexion = FilaCobertura[SistemaCobertura];

export const leerSistemaCobertura = (valor: string | undefined): SistemaCobertura =>
  (SISTEMAS_COBERTURA as readonly string[]).includes(valor ?? "")
    ? (valor as SistemaCobertura)
    : SISTEMA_INICIAL;

/** Tramos fijos, no cuantiles: un mismo tono significa lo mismo en los cuatro sistemas. */
export const nivelCobertura = (porcentaje: number | null): string => {
  if (porcentaje === null) return "cobertura-sin-dato";
  if (porcentaje === 0) return "cobertura-cero";
  return `nivel-${Math.min(Math.floor(porcentaje / 20) + 1, 5)}`;
};

const esDenominadorBajo = ({ aplicables }: Conexion): boolean =>
  aplicables > 0 && aplicables < UMBRAL_DENOMINADOR_BAJO;

export const etiquetaMapa = (conexion: Conexion): string => {
  const { porcentaje } = conexion;
  if (porcentaje === null) return "n/d";
  const texto =
    porcentaje > 0 && porcentaje < 1
      ? "<1%"
      : porcentaje > 99 && porcentaje < 100
        ? ">99%"
        : `${Math.round(porcentaje)}%`;
  return esDenominadorBajo(conexion) ? `${texto}*` : texto;
};

export const etiquetaPorcentaje = (porcentaje: number | null): string =>
  porcentaje === null ? "n/d" : `${porcentaje}%`;

export const brechaDe = ({ aplicables, conectados }: Conexion): number => aplicables - conectados;

export const filasDeEstados = (filas: readonly FilaCobertura[]): FilaCobertura[] =>
  filas.filter((f) => f.entidad !== CLAVE_FEDERACION);

const porNombre = (a: FilaCobertura, b: FilaCobertura): number => a.nombre.localeCompare(b.nombre);

/** De menos a más cobertura y, en un empate, primero donde hay más por conectar. */
export const ordenarPorCobertura = (
  filas: readonly FilaCobertura[],
  sistema: SistemaCobertura,
): FilaCobertura[] =>
  [...filas].sort(
    (a, b) =>
      (a[sistema].porcentaje ?? Number.POSITIVE_INFINITY) -
        (b[sistema].porcentaje ?? Number.POSITIVE_INFINITY) ||
      brechaDe(b[sistema]) - brechaDe(a[sistema]) ||
      porNombre(a, b),
  );

export interface LecturaSistema {
  enCero: FilaCobertura[];
  denominadorBajo: FilaCobertura[];
  mayoresBrechas: FilaCobertura[];
  completos: FilaCobertura[];
  brechaTotal: number;
  concentracionBrechas: number | null;
}

export const lecturaDeSistema = (
  filas: readonly FilaCobertura[],
  sistema: SistemaCobertura,
): LecturaSistema => {
  const conAplicables = filas.filter((f) => f[sistema].aplicables > 0);
  const suficientes = conAplicables.filter((f) => !esDenominadorBajo(f[sistema]));
  const mayoresBrechas = [...suficientes]
    .filter((f) => brechaDe(f[sistema]) > 0)
    .sort((a, b) => brechaDe(b[sistema]) - brechaDe(a[sistema]) || porNombre(a, b))
    .slice(0, MAX_BRECHAS);
  const brechaTotal = conAplicables.reduce((suma, f) => suma + brechaDe(f[sistema]), 0);
  const enLasMayores = mayoresBrechas.reduce((suma, f) => suma + brechaDe(f[sistema]), 0);
  return {
    enCero: suficientes
      .filter((f) => f[sistema].conectados === 0)
      .sort((a, b) => b[sistema].aplicables - a[sistema].aplicables || porNombre(a, b)),
    denominadorBajo: conAplicables.filter((f) => esDenominadorBajo(f[sistema])).sort(porNombre),
    mayoresBrechas,
    completos: conAplicables.filter((f) => f[sistema].porcentaje === 100).sort(porNombre),
    brechaTotal,
    concentracionBrechas:
      brechaTotal === 0 ? null : Math.round((enLasMayores / brechaTotal) * 1000) / 10,
  };
};

const lista = (filas: readonly FilaCobertura[]): string => filas.map((f) => f.nombre).join(", ");

/** Lo que se dice de un sistema. Habla de información por integrar, nunca de la conducta de un ente. */
export const textoLectura = (
  lectura: LecturaSistema,
  sistema: SistemaCobertura,
): { cero: string; prioridad: string; nulo: string | null } => {
  const { etiqueta } = DETALLE_SISTEMAS[sistema];
  const { enCero, denominadorBajo, mayoresBrechas, brechaTotal, concentracionBrechas } = lectura;
  const hayCeroBajo = denominadorBajo.some((f) => f[sistema].conectados === 0);

  let cero: string;
  if (enCero.length === 1) {
    cero = `1 estado sin ningún registro marcado como conectado a ${etiqueta}: ${lista(enCero)}.`;
  } else if (enCero.length > 1) {
    cero = `${enCero.length} estados sin ningún registro marcado como conectado a ${etiqueta}: ${lista(enCero)}.`;
  } else if (hayCeroBajo) {
    cero = `Fuera de los estados con menos de ${UMBRAL_DENOMINADOR_BAJO} registros, todos tienen al menos uno conectado a ${etiqueta}.`;
  } else {
    cero = `Todos los estados tienen al menos un registro conectado a ${etiqueta}.`;
  }

  const detalle = mayoresBrechas
    .map(
      (f) =>
        `${f.nombre} (${formatoNumero(brechaDe(f[sistema]))} de ${formatoNumero(f[sistema].aplicables)} por conectar)`,
    )
    .join(", ");
  const prioridad =
    mayoresBrechas.length === 0
      ? `No quedan registros por conectar a ${etiqueta} en los estados con ${UMBRAL_DENOMINADOR_BAJO} registros o más.`
      : `Para ${etiqueta}, conviene priorizar la integración de datos en ${detalle}. ` +
        `${mayoresBrechas.length === 1 ? "Ese estado concentra" : `Esos ${mayoresBrechas.length} estados concentran`} ` +
        `${concentracionBrechas ?? 0}% de los ${formatoNumero(brechaTotal)} registros de estados por conectar.`;

  const nulo =
    denominadorBajo.length === 0
      ? null
      : `Con menos de ${UMBRAL_DENOMINADOR_BAJO} registros a los que se les pide ${etiqueta}, el porcentaje dice poco y lleva asterisco: ${lista(denominadorBajo)}.`;

  return { cero, prioridad, nulo };
};

export const enlaceCobertura = (
  sistema: SistemaCobertura,
  periodo: string,
  estado: string | null,
): string =>
  `/tablero?periodo=${periodo}${estado ? `&estado=${estado}` : ""}&cobertura=${sistema}#cobertura-pdn`;
